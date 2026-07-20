import type { AmbientDocument } from '../ambient-schema'
import { z } from 'zod'

type DeepMutable<T> = T extends readonly (infer Item)[]
  ? DeepMutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
    : T

export type WorkspaceDocumentDto = DeepMutable<AmbientDocument>

export type WorkspaceDraftDto = {
  id: string
  phase: 'handoff' | 'review' | 'saved'
  ambientName: string
  promptExpiresAt: string | null
  agentSessionGeneration: number
  revision: number
  document: WorkspaceDocumentDto | null
}

export type WorkspaceSavedAmbientDto = {
  id: string
  version: number
  document: WorkspaceDocumentDto
}

export type WorkspaceSnapshotDto = {
  account: { kind: 'signed-out' } | { kind: 'signed-in'; username: string }
  draft: WorkspaceDraftDto | null
  savedAmbients: WorkspaceSavedAmbientDto[]
}

export type WorkspaceDraftRevisionDto = {
  ambientId: string
  name: string
  revision: number
  document: WorkspaceDocumentDto
}

export type WorkspaceDraftStatusDto = {
  revision: number
  agentSessionGeneration: number
}

export const ambientIdInputSchema = z.strictObject({
  ambientId: z.string().min(1).max(128),
})

export const capabilityParamsSchema = z.strictObject({
  capability: z.string().min(32).max(128),
})

export const createAmbientInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
})

export const publishAmbientInputSchema = ambientIdInputSchema.extend({
  draftRevision: z.number().int().positive(),
})

export const replaceAgentDraftInputSchema = z.strictObject({
  baseRevision: z.number().int().nonnegative(),
  document: z.unknown(),
})

export type CreateAmbientInput = z.infer<typeof createAmbientInputSchema>

export type CreateAmbientResult = {
  ambientId: string
  session: AgentSessionDto
}

export type CreateAgentSessionInput = z.infer<typeof ambientIdInputSchema>

export type DiscardAmbientDraftInput = z.infer<typeof ambientIdInputSchema>

export type DiscardAmbientDraftResult = {
  ambientDeleted: boolean
}

export type AgentSessionDto = {
  ambientId: string
  generation: number
  expiresAt: string
  url: string
}

export type AgentDraftDto = WorkspaceDraftRevisionDto & {
  previewUrl: string
}

export type ReplaceAgentDraftInput = {
  baseRevision: number
  document: WorkspaceDocumentDto
}

export type PublishAmbientInput = z.infer<typeof publishAmbientInputSchema>

export type PublishedAmbientDto = {
  id: string
  version: number
  document: WorkspaceDocumentDto
  draftRevision: number
  createdAt: string
}
