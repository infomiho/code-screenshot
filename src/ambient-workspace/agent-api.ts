import express from 'express'
import { config, prisma, type MiddlewareConfigFn } from 'wasp/server'
import type {
  GetAgentDraft,
  GetAgentSession,
  ReplaceAgentDraft,
} from 'wasp/server/api'
import { compileAmbientDocument } from '../ambient-compiler'
import { capabilityParamsSchema, replaceAgentDraftInputSchema } from './contracts'
import type { AgentDraftDto, ReplaceAgentDraftInput, WorkspaceDocumentDto } from './contracts'
import { agentPreviewUrl, agentSessionUrl, hashAgentCapability } from './agent-session-access'

type CapabilityParams = { capability: string }
type AgentError = {
  error: string
  message: string
  currentRevision?: number
  diagnostics?: ReturnType<typeof compileAmbientDocument>['diagnostics']
}
type ReplaceDraftResponse =
  | { revision: number; previewUrl: string }
  | AgentError

export const agentApiMiddleware: MiddlewareConfigFn = (middlewareConfig) => {
  middlewareConfig.delete('logger')
  middlewareConfig.set('express.json', express.json({ limit: '1mb' }))
  return middlewareConfig
}

const setPrivateHeaders = (res: { set: (name: string, value: string) => unknown }) => {
  res.set('Cache-Control', 'no-store')
  res.set('Referrer-Policy', 'no-referrer')
}

const findSession = (capability: string) => prisma.ambientAgentSession.findUnique({
  where: { capabilityHash: hashAgentCapability(capability) },
  include: { ambient: { include: { draft: true } } },
})

const getActiveSession = async (
  capability: unknown,
  res: { status: (code: number) => { json: (body: AgentError) => unknown } },
) => {
  const params = capabilityParamsSchema.safeParse({ capability })
  if (!params.success) {
    res.status(404).json({ error: 'not_found', message: 'Agent session not found.' })
    return null
  }
  const session = await findSession(params.data.capability)
  if (!session) {
    res.status(404).json({ error: 'not_found', message: 'Agent session not found.' })
    return null
  }
  if (
    session.expiresAt <= new Date()
    || session.generation !== session.ambient.agentSessionGeneration
  ) {
    res.status(410).json({
      error: 'agent_session_expired',
      message: 'Ask the user for a new codeshot.dev agent prompt.',
    })
    return null
  }
  if (!session.ambient.draft) {
    res.status(404).json({ error: 'draft_not_found', message: 'Ambient draft not found.' })
    return null
  }
  return session
}

const readDocument = (value: unknown) => {
  const result = compileAmbientDocument(value)
  return result.compiled
    ? JSON.parse(JSON.stringify(result.compiled.document)) as WorkspaceDocumentDto
    : null
}

export const getAgentSession: GetAgentSession<CapabilityParams, string | AgentError> = async (
  req,
  res,
) => {
  setPrivateHeaders(res)
  const session = await getActiveSession(req.params.capability, res)
  if (!session) return

  const baseUrl = agentSessionUrl(req.params.capability)
  const docsUrl = config.frontendUrl.replace(/\/$/, '')
  res.type('text/markdown').send(`# codeshot.dev ambient session

Session URL: ${baseUrl}
Expires: ${session.expiresAt.toISOString()}

Read and follow:

- ${docsUrl}/agent/api.md
- ${docsUrl}/agent/ambient-schema.md`)
}

export const getAgentDraft: GetAgentDraft<CapabilityParams, AgentDraftDto | AgentError> = async (
  req,
  res,
) => {
  setPrivateHeaders(res)
  const session = await getActiveSession(req.params.capability, res)
  if (!session?.ambient.draft) return
  const document = readDocument(session.ambient.draft.document)
  if (!document) {
    res.status(500).json({ error: 'stored_draft_invalid', message: 'Stored ambient is invalid.' })
    return
  }

  await prisma.ambientAgentSession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  })
  res.json({
    ambientId: session.ambient.id,
    name: session.ambient.name,
    revision: session.ambient.draft.revision,
    document,
    previewUrl: agentPreviewUrl(req.params.capability),
  })
}

export const replaceAgentDraft: ReplaceAgentDraft<
  CapabilityParams,
  ReplaceDraftResponse,
  ReplaceAgentDraftInput
> = async (req, res) => {
  setPrivateHeaders(res)
  const session = await getActiveSession(req.params.capability, res)
  if (!session?.ambient.draft) return

  const input = replaceAgentDraftInputSchema.safeParse(req.body)
  if (!input.success) {
    res.status(400).json({ error: 'invalid_request', message: 'Invalid draft update request.' })
    return
  }
  const result = compileAmbientDocument(input.data.document)
  if (!result.compiled) {
    res.status(422).json({
      error: 'ambient_invalid',
      message: 'Fix the diagnostics and submit the complete document again.',
      diagnostics: result.diagnostics,
    })
    return
  }
  const document = result.compiled.document
  const updated = await prisma.$transaction(async (transaction) => {
    const sessionUpdate = await transaction.ambientAgentSession.updateMany({
      where: {
        id: session.id,
        generation: session.generation,
        expiresAt: { gt: new Date() },
      },
      data: { lastUsedAt: new Date() },
    })
    if (sessionUpdate.count === 0) return { kind: 'expired' as const }

    const draftUpdate = await transaction.ambientDraft.updateMany({
      where: {
        ambientId: session.ambientId,
        revision: input.data.baseRevision,
      },
      data: {
        revision: { increment: 1 },
        schemaVersion: document.schemaVersion,
        document: JSON.parse(JSON.stringify(document)),
        updatedBy: `agent:${session.id}`,
      },
    })
    if (draftUpdate.count === 0) return { kind: 'conflict' as const }

    await transaction.ambient.update({
      where: { id: session.ambientId },
      data: { name: document.name },
    })
    return { kind: 'accepted' as const, revision: input.data.baseRevision + 1 }
  })

  if (updated.kind === 'expired') {
    res.status(410).json({
      error: 'agent_session_expired',
      message: 'Ask the user for a new codeshot.dev agent prompt.',
    })
    return
  }
  if (updated.kind === 'conflict') {
    const current = await prisma.ambientDraft.findUnique({
      where: { ambientId: session.ambientId },
      select: { revision: true },
    })
    res.status(409).json({
      error: 'draft_revision_conflict',
      message: 'Refetch the current draft and retry your changes.',
      currentRevision: current?.revision,
    })
    return
  }

  res.json({ revision: updated.revision, previewUrl: agentPreviewUrl(req.params.capability) })
}
