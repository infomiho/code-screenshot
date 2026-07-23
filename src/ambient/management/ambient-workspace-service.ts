import type { AmbientDocument } from '../schema'
import type {
  AgentAccessSummaryDto,
  AmbientAccountDto,
  AmbientLinkSharingDto,
  AmbientSyncTokenDto,
  OwnedAmbientDraftSummaryDto,
} from './contracts'

type OwnedAmbientDraftSummary = Omit<OwnedAmbientDraftSummaryDto, 'document'> & {
  document: AmbientDocument
}

export type SavedAmbientRecord = {
  id: string
  version: number
  document: AmbientDocument
  draftRevision?: number
  createdAt?: string
}

export type CurrentAmbientVersion = SavedAmbientRecord & {
  draftRevision: number
  createdAt: string
}

export type OwnedAmbientSummary = {
  id: string
  name: string
  visibility: 'private' | 'link'
  currentVersion: CurrentAmbientVersion | null
  draft: OwnedAmbientDraftSummary | null
}

export const countDraftAmbients = (ambients: readonly OwnedAmbientSummary[]) =>
  ambients.filter((ambient) => ambient.draft !== null).length

export type WorkingDraft = {
  revision: number
  baseRevision: number
  sourceVersion: number | null
  document: AmbientDocument
  updatedAt: string
  acceptedChangeCount: number
}

export type AmbientVersion = CurrentAmbientVersion & {
  isInUse: boolean
}

export type OpenAmbientWorkspace = {
  ambient: {
    id: string
    name: string
    slug: string
    linkSharing: AmbientLinkSharingDto
  }
  syncToken: AmbientSyncTokenDto
  workingDraft: WorkingDraft | null
  versionInUse: CurrentAmbientVersion | null
  versions: readonly AmbientVersion[]
  agentAccess: AgentAccessSummaryDto
  agentAccessUrl: string | null
  promptCopied: boolean
  connectivity: 'online' | 'offline' | 'request-error'
  mutation: 'idle' | 'creating-access' | 'saving' | 'discarding' | 'restoring'
}

export type AmbientWorkspaceSnapshot = {
  isHydrated: boolean
  libraryStatus: 'loading' | 'ready' | 'offline' | 'request-error'
  account: AmbientAccountDto
  ownedAmbients: readonly OwnedAmbientSummary[]
  workspace: OpenAmbientWorkspace | null
}

export interface AmbientWorkspaceService {
  getSnapshot: () => AmbientWorkspaceSnapshot
  getServerSnapshot: () => AmbientWorkspaceSnapshot
  subscribe: (listener: () => void) => () => void
  signIn: () => void
  signOut: () => Promise<void>
  refreshLibrary: () => Promise<void>
  openWorkspace: (ambientId: string) => Promise<boolean>
  closeWorkspace: () => void
  createAmbient: (ambientName: string) => Promise<string | null>
  createAgentAccess: (ambientId?: string) => Promise<boolean>
  discardAgentAccess: () => Promise<boolean>
  copyPrompt: () => void
  saveAmbientVersion: () => Promise<SavedAmbientRecord | null>
  discardAmbientDraft: () => Promise<boolean>
  createDraftFromVersion: (versionId: string) => Promise<boolean>
  deleteAmbient: (ambientId: string) => Promise<boolean>
  setLinkSharing: (enabled: boolean) => Promise<boolean>
}
