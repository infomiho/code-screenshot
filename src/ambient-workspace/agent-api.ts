import express from 'express'
import { config, prisma, type MiddlewareConfigFn } from 'wasp/server'
import type {
  GetAgentDraft,
  GetAgentPreview,
  GetAgentSession,
  ReplaceAgentDraft,
} from 'wasp/server/api'
import { compileAmbientDocument } from '../ambient-compiler'
import type { AmbientDocument } from '../ambient-schema'
import { capabilityParamsSchema, replaceAgentDraftInputSchema } from './contracts'
import type { AgentDraftDto, ReplaceAgentDraftInput, WorkspaceDocumentDto } from './contracts'
import { agentPreviewUrl, hashAgentCapability } from './agent-session-access'

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

  const baseUrl = agentPreviewUrl(req.params.capability).replace(/\/preview$/, '')
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

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

const renderPreview = (document: AmbientDocument) => {
  const compiled = compileAmbientDocument(document).compiled!
  const content = {
    title: 'Agent preview',
    fileTypeId: 'typescript',
    fileTypeLabel: 'TypeScript',
    lineCount: 4,
  }
  let template = compiled.template.replace(
    '<slot name="code"></slot>',
    '<pre class="code-slot"><code>const ambient = {\n  status: \'preview\',\n  private: true,\n}</code></pre>',
  )
  for (const binding of compiled.bindings) {
    const raw = content[binding.source]
    const value = binding.format === 'pad-3'
      ? String(raw).padStart(3, '0')
      : String(raw)
    template = template.replace(
      `<span data-ambient-binding="${binding.id}"></span>`,
      `<span data-ambient-binding="${binding.id}">${escapeHtml(value)}</span>`,
    )
  }
  const stylesheet = document.stylesheet
    .replaceAll(':host', '.ambient-preview')
    .replaceAll('::slotted([slot=code])', '.ambient-preview .code-slot')
    .replaceAll(/<\/style/gi, '<\\/style')

  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(document.name)} preview</title>
<style>
html,body{margin:0;min-height:100%;background:#111;color:#f7f5f0;font-family:system-ui,sans-serif}
body{display:grid;place-items:center;padding:24px;box-sizing:border-box}
.ambient-preview{width:min(860px,100%);box-sizing:border-box}
.code-slot{margin:0;white-space:pre-wrap;font:14px/1.6 ui-monospace,monospace}
${stylesheet}
</style>
<main class="ambient-preview">${template}</main>
</html>`
}

export const getAgentPreview: GetAgentPreview<CapabilityParams, string | AgentError> = async (
  req,
  res,
) => {
  setPrivateHeaders(res)
  res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'")
  const session = await getActiveSession(req.params.capability, res)
  if (!session?.ambient.draft) return
  const document = readDocument(session.ambient.draft.document)
  if (!document) {
    res.status(500).json({ error: 'stored_draft_invalid', message: 'Stored ambient is invalid.' })
    return
  }
  res.type('html').send(renderPreview(document))
}
