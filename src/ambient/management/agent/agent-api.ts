import express from 'express'
import { config, env, prisma, type MiddlewareConfigFn } from 'wasp/server'
import type {
  AgentWorkRoute,
  GetAgentDocs,
  GetAgentSession,
} from 'wasp/server/api'
import {
  buildCapabilityUrl,
  createAgentWorkProtocol,
  noErrors,
  type ProtocolRequest,
  type ProtocolResponse,
  type RevisionStore,
  type SessionStore,
} from '@infomiho/agent-work-protocol/server'
import { ambientWorkModel } from '../../work-model'
import type { AmbientDocument } from '../../schema'
import { publishAmbientChange } from '../ambient-change-stream'

type AmbientAgentAuthority = {
  sessionId: string
  generation: number
  attribution: string
}

export const agentApiMiddleware: MiddlewareConfigFn = (middlewareConfig) => {
  middlewareConfig.delete('logger')
  middlewareConfig.set('express.json', express.json({ limit: '1mb' }))
  return middlewareConfig
}

const protocol = createAgentWorkProtocol({
  model: ambientWorkModel,
  sessions: prismaSessionStore(),
  revisions: prismaRevisionStore(),
  policy: noErrors,
  serverUrl: env.WASP_SERVER_URL,
  previewUrl: agentPreviewUrl,
  productName: 'codeshot.dev',
  revisionCommitted: ({ target }) => publishAmbientChange({ ambientId: target.document }),
})

export const mintAgentCapability = protocol.mintSession

export const getAgentSession: GetAgentSession = async (request, response) => {
  sendProtocolResponse(response, await protocol.handleSessionRequest({
    capability: routeParam(request.params.capability),
  }))
}

// Wasp has no PATCH verb, so one ALL route serves every work method and lets
// the protocol reject unsupported methods.
export const agentWorkRoute: AgentWorkRoute = async (request, response) => {
  const protocolRequest: ProtocolRequest = {
    method: request.method,
    capability: routeParam(request.params.capability),
    headers: { 'if-match': header(request.headers['if-match']) },
    contentType: request.get('content-type'),
    body: request.body,
  }
  sendProtocolResponse(response, await protocol.handleWorkRequest(protocolRequest))
}

export const getAgentDocs: GetAgentDocs = (request, response) => {
  sendProtocolResponse(response, protocol.handleDocsRequest({
    model: routeParam(request.params.model),
    version: routeParam(request.params.version),
    document: routeParam(request.params.document),
  }))
}

function agentPreviewUrl(capability: string) {
  return buildCapabilityUrl(config.frontendUrl, 'agent-preview', capability)
}

function prismaSessionStore(): SessionStore<AmbientAgentAuthority> {
  return {
    findByCapabilityHash: async (capabilityHash) => {
      const session = await prisma.ambientAgentSession.findUnique({
        where: { capabilityHash },
      })
      if (!session) return null
      return {
        id: session.id,
        expiresAt: session.expiresAt,
        target: {
          model: ambientWorkModel.id,
          version: ambientWorkModel.version,
          document: session.ambientId,
        },
        authority: {
          sessionId: session.id,
          generation: session.generation,
          attribution: `agent:${session.id}`,
        },
      }
    },
    touch: async (sessionId) => {
      await prisma.ambientAgentSession.update({
        where: { id: sessionId },
        data: { lastUsedAt: new Date() },
      })
    },
  }
}

function prismaRevisionStore(): RevisionStore<AmbientDocument, AmbientAgentAuthority> {
  const targetsAmbientModel = (target: { model: string; version: string }) =>
    target.model === ambientWorkModel.id && target.version === ambientWorkModel.version

  return {
    read: async (command) => {
      if (!targetsAmbientModel(command.target)) {
        return { kind: 'authority-rejected', reason: 'forbidden' }
      }
      const session = await prisma.ambientAgentSession.findUnique({
        where: { id: command.authority.sessionId },
        select: {
          ambientId: true,
          generation: true,
          expiresAt: true,
          ambient: {
            select: {
              agentSessionGeneration: true,
              draft: { select: { revision: true, document: true } },
            },
          },
        },
      })
      if (!session) return { kind: 'authority-rejected', reason: 'revoked' }
      if (
        session.ambientId !== command.target.document
        || session.generation !== command.authority.generation
      ) {
        return { kind: 'authority-rejected', reason: 'forbidden' }
      }
      if (session.expiresAt <= command.now) return { kind: 'authority-rejected', reason: 'expired' }
      if (session.generation !== session.ambient.agentSessionGeneration) {
        return { kind: 'authority-rejected', reason: 'revoked' }
      }
      const draft = session.ambient.draft
      return draft
        ? { kind: 'read', revision: draft.revision, document: draft.document as unknown as AmbientDocument }
        : { kind: 'target-not-found' }
    },
    commit: (command) => prisma.$transaction(async (transaction) => {
      if (!targetsAmbientModel(command.target)) {
        return { kind: 'authority-rejected' as const, reason: 'forbidden' as const }
      }

      const sessionUpdate = await transaction.ambientAgentSession.updateMany({
        where: {
          id: command.authority.sessionId,
          ambientId: command.target.document,
          generation: command.authority.generation,
          expiresAt: { gt: command.now },
          ambient: { agentSessionGeneration: command.authority.generation },
        },
        data: { lastUsedAt: command.now },
      })
      if (sessionUpdate.count === 0) {
        const session = await transaction.ambientAgentSession.findUnique({
          where: { id: command.authority.sessionId },
          select: {
            ambientId: true,
            generation: true,
            expiresAt: true,
            ambient: { select: { agentSessionGeneration: true } },
          },
        })
        if (!session) return { kind: 'authority-rejected' as const, reason: 'revoked' as const }
        if (
          session.ambientId !== command.target.document
          || session.generation !== command.authority.generation
        ) {
          return { kind: 'authority-rejected' as const, reason: 'forbidden' as const }
        }
        if (session.expiresAt <= command.now) {
          return { kind: 'authority-rejected' as const, reason: 'expired' as const }
        }
        if (session.generation !== session.ambient.agentSessionGeneration) {
          return { kind: 'authority-rejected' as const, reason: 'revoked' as const }
        }
        return { kind: 'authority-rejected' as const, reason: 'forbidden' as const }
      }

      const nextRevision = command.expectedRevision + 1
      const draftUpdate = await transaction.ambientDraft.updateMany({
        where: {
          ambientId: command.target.document,
          revision: command.expectedRevision,
        },
        data: {
          revision: nextRevision,
          schemaVersion: command.document.schemaVersion,
          document: command.document,
          updatedBy: command.authority.attribution,
        },
      })
      if (draftUpdate.count === 0) {
        const current = await transaction.ambientDraft.findUnique({
          where: { ambientId: command.target.document },
          select: { revision: true },
        })
        return current
          ? { kind: 'conflict' as const, currentRevision: current.revision }
          : { kind: 'target-not-found' as const }
      }

      await transaction.ambient.update({
        where: { id: command.target.document },
        data: { name: command.document.name },
      })
      return { kind: 'committed' as const, revision: nextRevision }
    }),
  }
}

function sendProtocolResponse(response: Parameters<GetAgentSession>[1], protocolResponse: ProtocolResponse) {
  for (const [name, value] of Object.entries(protocolResponse.headers)) response.set(name, value)
  response.status(protocolResponse.status)
  if (protocolResponse.content.type === 'none') response.end()
  else if (protocolResponse.content.type === 'markdown') response.send(protocolResponse.content.body)
  else response.json(protocolResponse.content.body)
}

const routeParam = (value: string | string[] | undefined) => typeof value === 'string' ? value : ''
const header = (value: string | string[] | undefined) => typeof value === 'string' ? value : undefined
