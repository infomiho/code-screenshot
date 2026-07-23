import express from 'express'
import { config, prisma, type MiddlewareConfigFn } from 'wasp/server'
import type {
  AgentDraftRoute,
  GetAgentSession,
} from 'wasp/server/api'
import { compileAmbientDocument } from '../../compiler'
import type { AmbientDocument } from '../../schema'
import { capabilityParamsSchema, patchAgentDraftInputSchema, replaceAgentDraftInputSchema } from '../contracts'
import type { AgentDraftDto, PatchAgentDraftInput, ReplaceAgentDraftInput, WorkspaceDocumentDto } from '../contracts'
import { agentPreviewUrl, agentSessionUrl, hashAgentCapability } from './agent-session-access'
import { publishAmbientChange } from '../ambient-change-stream'

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

type ActiveAgentSession = NonNullable<Awaited<ReturnType<typeof getActiveSession>>>

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const applyJsonMergePatch = (target: unknown, patch: unknown): unknown => {
  if (!isJsonObject(patch)) {
    return patch
  }
  const merged: Record<string, unknown> = isJsonObject(target) ? { ...target } : {}
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete merged[key]
    } else {
      merged[key] = applyJsonMergePatch(merged[key], value)
    }
  }
  return merged
}

type CommitOutcome =
  | { kind: 'expired' }
  | { kind: 'conflict' }
  | { kind: 'accepted'; revision: number }

type CommitResponder = {
  status: (code: number) => { json: (body: AgentError) => unknown }
  json: (body: ReplaceDraftResponse) => unknown
}

const commitDraftUpdate = (
  session: ActiveAgentSession,
  baseRevision: number,
  document: AmbientDocument,
): Promise<CommitOutcome> => prisma.$transaction(async (transaction) => {
  const sessionUpdate = await transaction.ambientAgentSession.updateMany({
    where: {
      id: session.id,
      generation: session.generation,
      expiresAt: { gt: new Date() },
    },
    data: { lastUsedAt: new Date() },
  })
  if (sessionUpdate.count === 0) {
    return { kind: 'expired' as const }
  }

  const draftUpdate = await transaction.ambientDraft.updateMany({
    where: {
      ambientId: session.ambientId,
      revision: baseRevision,
    },
    data: {
      revision: { increment: 1 },
      schemaVersion: document.schemaVersion,
      document: JSON.parse(JSON.stringify(document)),
      updatedBy: `agent:${session.id}`,
    },
  })
  if (draftUpdate.count === 0) {
    return { kind: 'conflict' as const }
  }

  await transaction.ambient.update({
    where: { id: session.ambientId },
    data: { name: document.name },
  })
  return { kind: 'accepted' as const, revision: baseRevision + 1 }
})

const sendCommitResult = async (
  res: CommitResponder,
  capability: string,
  session: ActiveAgentSession,
  outcome: CommitOutcome,
) => {
  if (outcome.kind === 'expired') {
    res.status(410).json({
      error: 'agent_session_expired',
      message: 'Ask the user for a new codeshot.dev agent prompt.',
    })
    return
  }
  if (outcome.kind === 'conflict') {
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
  res.json({ revision: outcome.revision, previewUrl: agentPreviewUrl(capability) })
  publishAmbientChange({
    ambientId: session.ambientId,
  })
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

export const getAgentDraft: AgentDraftRoute<CapabilityParams, AgentDraftDto | AgentError> = async (
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

export const replaceAgentDraft: AgentDraftRoute<
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
  const outcome = await commitDraftUpdate(session, input.data.baseRevision, result.compiled.document)
  await sendCommitResult(res, req.params.capability, session, outcome)
}

export const patchAgentDraft: AgentDraftRoute<
  CapabilityParams,
  ReplaceDraftResponse,
  PatchAgentDraftInput
> = async (req, res) => {
  setPrivateHeaders(res)
  if (req.method !== 'PATCH') {
    res.set('Allow', 'GET, HEAD, PUT, PATCH')
    res.status(405).json({
      error: 'method_not_allowed',
      message: 'Use GET, PUT, or PATCH on the draft.',
    })
    return
  }
  const session = await getActiveSession(req.params.capability, res)
  if (!session?.ambient.draft) return

  const input = patchAgentDraftInputSchema.safeParse(req.body)
  if (!input.success) {
    res.status(400).json({ error: 'invalid_request', message: 'Invalid draft update request.' })
    return
  }
  const document = readDocument(session.ambient.draft.document)
  if (!document) {
    res.status(500).json({ error: 'stored_draft_invalid', message: 'Stored ambient is invalid.' })
    return
  }
  const merged = applyJsonMergePatch(document, input.data.patch)
  const result = compileAmbientDocument(merged)
  if (!result.compiled) {
    res.status(422).json({
      error: 'ambient_invalid',
      message: 'Fix the diagnostics and retry the patch.',
      diagnostics: result.diagnostics,
    })
    return
  }
  const outcome = await commitDraftUpdate(session, input.data.baseRevision, result.compiled.document)
  await sendCommitResult(res, req.params.capability, session, outcome)
}

// Wasp has no PATCH method and forbids an ALL route beside GET/PUT on the same path,
// so a single ALL route dispatches the draft verbs. patchAgentDraft answers every other method with 405.
export const agentDraftRoute: AgentDraftRoute<CapabilityParams> = (req, res, context) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return getAgentDraft(req, res, context)
  }
  if (req.method === 'PUT') {
    return replaceAgentDraft(req, res, context)
  }
  return patchAgentDraft(req, res, context)
}
