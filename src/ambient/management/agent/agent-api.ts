import express from 'express'
import { config, env, prisma, type MiddlewareConfigFn } from 'wasp/server'
import type {
  AgentDraftRoute,
  GetAgentDocs,
  GetAgentSession,
} from 'wasp/server/api'
import {
  buildCapabilityUrl,
  createSubmissionProtocol,
  type DraftStore,
  type SessionStore,
} from '@infomiho/agent-work-protocol/server'
import { createExpressHandlers } from '@infomiho/agent-work-protocol/adapters/express'
import { ambientDocumentSpec } from '../../document-spec'
import type { AmbientDocument } from '../../schema'
import { publishAmbientChange } from '../ambient-change-stream'

export const agentApiMiddleware: MiddlewareConfigFn = (middlewareConfig) => {
  middlewareConfig.delete('logger')
  middlewareConfig.set('express.json', express.json({ limit: '1mb' }))
  return middlewareConfig
}

const protocol = createSubmissionProtocol({
  sessions: prismaSessionStore(),
  drafts: prismaDraftStore(),
  spec: ambientDocumentSpec,
  serverUrl: env.WASP_SERVER_URL,
  previewUrl: agentPreviewUrl,
  productName: 'codeshot.dev',
  onAccepted: ({ workId }) => publishAmbientChange({ ambientId: workId }),
})

export const mintAgentCapability = protocol.mintSession

const handlers = createExpressHandlers(protocol)

export const getAgentSession: GetAgentSession = handlers.session

// Wasp has no PATCH verb and forbids an ALL route next to GET/PUT on one
// path, so one ALL route serves every draft method; the protocol 405s the rest.
export const agentDraftRoute: AgentDraftRoute = handlers.draft

export const getAgentDocs: GetAgentDocs = handlers.docs

function agentPreviewUrl(capability: string) {
  return buildCapabilityUrl(config.frontendUrl, 'agent-preview', capability)
}

function prismaSessionStore(): SessionStore {
  return {
    findByCapabilityHash: async (capabilityHash) => {
      const session = await prisma.ambientAgentSession.findUnique({
        where: { capabilityHash },
        include: { ambient: { include: { draft: true } } },
      })
      if (!session) return null
      return {
        session: {
          id: session.id,
          workId: session.ambientId,
          generation: session.generation,
          expiresAt: session.expiresAt,
        },
        workName: session.ambient.name,
        workGeneration: session.ambient.agentSessionGeneration,
        draft: session.ambient.draft
          ? { revision: session.ambient.draft.revision, document: session.ambient.draft.document }
          : null,
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

function prismaDraftStore(): DraftStore<AmbientDocument> {
  return {
    commit: (command) => prisma.$transaction(async (transaction) => {
      const sessionUpdate = await transaction.ambientAgentSession.updateMany({
        where: {
          id: command.sessionId,
          generation: command.requiredGeneration,
          expiresAt: { gt: command.now },
        },
        data: { lastUsedAt: command.now },
      })
      if (sessionUpdate.count === 0) {
        return { kind: 'expired' as const }
      }

      const draftUpdate = await transaction.ambientDraft.updateMany({
        where: {
          ambientId: command.workId,
          revision: command.expectedRevision,
        },
        data: {
          revision: command.nextRevision,
          schemaVersion: command.document.schemaVersion,
          document: command.document,
          updatedBy: command.attribution,
        },
      })
      if (draftUpdate.count === 0) {
        const current = await transaction.ambientDraft.findUnique({
          where: { ambientId: command.workId },
          select: { revision: true },
        })
        return { kind: 'conflict' as const, currentRevision: current?.revision ?? null }
      }

      await transaction.ambient.update({
        where: { id: command.workId },
        data: { name: command.document.name },
      })
      return { kind: 'accepted' as const, revision: command.nextRevision }
    }),
  }
}
