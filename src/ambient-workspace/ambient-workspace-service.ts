import type { AmbientDocument } from '../ambient-schema'
import type {
  AgentAccessSummaryDto,
  AmbientAccountDto,
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
  visibility: 'private'
  currentVersion: CurrentAmbientVersion | null
  draft: OwnedAmbientDraftSummary | null
}

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
  ambient: { id: string; name: string }
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
  signOut: () => void
  refreshLibrary: () => Promise<void>
  openWorkspace: (ambientId: string) => Promise<boolean>
  closeWorkspace: () => void
  createAmbient: (ambientName: string) => Promise<string | null>
  createAgentAccess: () => Promise<boolean>
  discardAgentAccess: () => Promise<boolean>
  copyPrompt: () => void
  saveAmbientVersion: () => Promise<SavedAmbientRecord | null>
  discardAmbientDraft: () => Promise<boolean>
  createDraftFromVersion: (versionId: string) => Promise<boolean>
}
