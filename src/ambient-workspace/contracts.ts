import type { AmbientDocument } from '../ambient-schema'
import { z } from 'zod'

type DeepMutable<T> = T extends readonly (infer Item)[]
  ? DeepMutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
    : T

export type WorkspaceDocumentDto = DeepMutable<AmbientDocument>

export type AmbientAccountDto =
  | { kind: 'signed-out' }
  | { kind: 'signed-in'; username: string }

export type SavedAmbientVersionDto = {
  id: string
  version: number
  document: WorkspaceDocumentDto
  draftRevision: number
  createdAt: string
}

export type OwnedAmbientDraftSummaryDto = {
  status: 'waiting' | 'review-ready' | 'matches-version'
  revision: number
  document: WorkspaceDocumentDto
  updatedAt: string
}

export type OwnedAmbientSummaryDto = {
  id: string
  name: string
  visibility: 'private'
  currentVersion: SavedAmbientVersionDto | null
  draft: OwnedAmbientDraftSummaryDto | null
}

export type AmbientLibraryDto = {
  account: AmbientAccountDto
  ownedAmbients: OwnedAmbientSummaryDto[]
}

export type WorkingDraftDto = {
  revision: number
  baseRevision: number
  sourceVersion: number | null
  document: WorkspaceDocumentDto
  updatedAt: string
  acceptedChangeCount: number
}

export type AmbientVersionSummaryDto = SavedAmbientVersionDto & {
  isInUse: boolean
}

export type AgentAccessSummaryDto =
  | { status: 'not-created' }
  | { status: 'available'; generation: number; expiresAt: string; lastUsedAt: string | null }
  | { status: 'expired'; generation: number; expiresAt: string }

export type AmbientWorkspaceDto = {
  ambient: { id: string; name: string }
  workingDraft: WorkingDraftDto | null
  versionInUse: SavedAmbientVersionDto | null
  versions: AmbientVersionSummaryDto[]
  agentAccess: AgentAccessSummaryDto
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

export const saveAmbientVersionInputSchema = ambientIdInputSchema.extend({
  draftRevision: z.number().int().nonnegative(),
})

export const createDraftFromVersionInputSchema = ambientIdInputSchema.extend({
  versionId: z.string().min(1).max(128),
})

export const replaceAgentDraftInputSchema = z.strictObject({
  baseRevision: z.number().int().nonnegative(),
  document: z.unknown(),
})

export type CreateAmbientInput = z.infer<typeof createAmbientInputSchema>
export type SaveAmbientVersionInput = z.infer<typeof saveAmbientVersionInputSchema>
export type CreateDraftFromVersionInput = z.infer<typeof createDraftFromVersionInputSchema>
export type AmbientIdInput = z.infer<typeof ambientIdInputSchema>
export type CreateAgentAccessInput = AmbientIdInput
export type DiscardAgentAccessInput = AmbientIdInput
export type DiscardAmbientDraftInput = AmbientIdInput
export type DeleteAmbientInput = AmbientIdInput

export type CreateAmbientResult = {
  ambientId: string
}

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
