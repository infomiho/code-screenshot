import type { AmbientDocument } from '../schema'
import type { WorkResponse } from '@infomiho/agent-work-protocol'
import { z } from 'zod'

type DeepMutable<T> = T extends readonly (infer Item)[]
  ? DeepMutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
    : T

export type WorkspaceDocumentDto = DeepMutable<AmbientDocument>

export type AmbientAccountDto =
  | { kind: 'signed-out' }
  | { kind: 'signed-in'; username: string; avatarUrl: string | null; isAdmin: boolean }

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

export const documentsEqual = (a: AmbientDocument, b: AmbientDocument) =>
  JSON.stringify(a) === JSON.stringify(b)

export const deriveDraftStatus = (
  draftDocument: AmbientDocument,
  acceptedChangeCount: number,
  versionDocument: AmbientDocument | null,
): OwnedAmbientDraftSummaryDto['status'] => {
  if (!versionDocument) return acceptedChangeCount > 0 ? 'review-ready' : 'waiting'
  return documentsEqual(draftDocument, versionDocument) ? 'matches-version' : 'review-ready'
}

export type OwnedAmbientSummaryDto = {
  id: string
  name: string
  slug: string
  shareId: string | null
  visibility: 'private' | 'link'
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

export type AmbientOwnership = 'guest' | 'owned'

export type AmbientWorkspaceDto = {
  ambient: {
    id: string
    name: string
    slug: string
    ownership: AmbientOwnership
    linkSharing: AmbientLinkSharingDto
  }
  syncToken: AmbientSyncTokenDto
  workingDraft: WorkingDraftDto | null
  versionInUse: SavedAmbientVersionDto | null
  versions: AmbientVersionSummaryDto[]
  agentAccess: AgentAccessSummaryDto
}

export type AmbientLinkSharingDto = {
  enabled: boolean
  shareId: string | null
}

export type SharedAmbientDto = {
  id: string
  slug: string
  isOwnedByViewer: boolean
  version: SavedAmbientVersionDto
}

export type WorkspaceDraftRevisionDto = {
  ambientId: string
  name: string
  revision: number
  document: WorkspaceDocumentDto
}

export type AmbientSyncTokenDto = {
  revision: number | null
  agentSessionGeneration: number
  currentVersion: number | null
}

export const createSyncToken = (
  revision: number | null,
  agentSessionGeneration = 0,
  currentVersion: number | null = null,
): AmbientSyncTokenDto => ({ revision, agentSessionGeneration, currentVersion })

export type SyncAmbientDraftResult =
  | { kind: 'unchanged'; token: AmbientSyncTokenDto }
  | {
      kind: 'draft-changed'
      token: AmbientSyncTokenDto
      name: string
      draft: WorkingDraftDto
    }
  | { kind: 'workspace-invalidated'; token: AmbientSyncTokenDto }

// In the body, not the URL: the operations router logs every request line.
export const guestTokenSchema = z.string().min(20).max(128)

// The change stream is a GET, so its credential travels in a header for the same reason.
export const guestTokenHeader = 'x-codeshot-guest-token'

const guestCredentialShape = { guestToken: guestTokenSchema.optional() }

export const ambientIdInputSchema = z.strictObject({
  ambientId: z.string().min(1).max(128),
  ...guestCredentialShape,
})

export const sharedAmbientInputSchema = z.strictObject({
  shareId: z.string().min(20).max(64),
})

export const copySharedAmbientInputSchema = sharedAmbientInputSchema.extend(guestCredentialShape)

export const setAmbientLinkSharingInputSchema = ambientIdInputSchema.extend({
  enabled: z.boolean(),
})

export const ambientNameSchema = z.string().trim().min(1).max(80)

export const createAmbientInputSchema = z.strictObject({
  name: ambientNameSchema,
  ...guestCredentialShape,
})

export const renameAmbientInputSchema = ambientIdInputSchema.extend({
  name: ambientNameSchema,
})

export const claimGuestAmbientsInputSchema = z.strictObject({
  guestToken: guestTokenSchema,
})

export const saveAmbientVersionInputSchema = ambientIdInputSchema.extend({
  draftRevision: z.number().int().nonnegative(),
})

export const createDraftFromVersionInputSchema = ambientIdInputSchema.extend({
  versionId: z.string().min(1).max(128),
})

export const syncAmbientDraftInputSchema = ambientIdInputSchema.extend({
  knownRevision: z.number().int().nonnegative().nullable(),
  knownAgentSessionGeneration: z.number().int().nonnegative(),
  knownCurrentVersion: z.number().int().nonnegative().nullable(),
})

export type CreateAmbientInput = z.infer<typeof createAmbientInputSchema>
export type RenameAmbientInput = z.infer<typeof renameAmbientInputSchema>
export type ClaimGuestAmbientsInput = z.infer<typeof claimGuestAmbientsInputSchema>
export type SaveAmbientVersionInput = z.infer<typeof saveAmbientVersionInputSchema>
export type CreateDraftFromVersionInput = z.infer<typeof createDraftFromVersionInputSchema>
export type SyncAmbientDraftInput = z.infer<typeof syncAmbientDraftInputSchema>
export type AmbientIdInput = z.infer<typeof ambientIdInputSchema>
export type SharedAmbientInput = z.infer<typeof sharedAmbientInputSchema>
export type CopySharedAmbientInput = z.infer<typeof copySharedAmbientInputSchema>
export type SetAmbientLinkSharingInput = z.infer<typeof setAmbientLinkSharingInputSchema>
export type CreateAgentAccessInput = AmbientIdInput
export type DiscardAgentAccessInput = AmbientIdInput
export type DiscardAmbientDraftInput = AmbientIdInput
export type DeleteAmbientInput = AmbientIdInput

export type CreateAmbientResult = {
  ambientId: string
  guestToken?: string
}

export type ClaimGuestAmbientsResult = {
  claimedAmbientIds: string[]
  discardedAmbientIds: string[]
}

export type RenameAmbientResult = {
  name: string
  revision: number | null
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

export type AgentWorkDto = WorkResponse<WorkspaceDocumentDto>
