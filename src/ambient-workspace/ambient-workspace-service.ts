import type { AmbientDocument } from '../ambient-schema'

export type AgentPhase = 'setup' | 'handoff' | 'review' | 'saved'
export type AgentNotice = 'rejected' | 'expired' | 'offline' | null

export type AgentDraftModel = {
  id: string
  phase: AgentPhase
  notice: AgentNotice
  ambientName: string | null
  designDirection: string
  promptCopied: boolean
  promptExpiresAt: string | null
  saveState: 'idle' | 'saving'
  revision: number
  document: AmbientDocument | null
}

export type SavedAmbientRecord = {
  id: string
  version: number
  document: AmbientDocument
}

export type AmbientAccount =
  | { kind: 'signed-out' }
  | { kind: 'signed-in'; username: string }

export type AmbientWorkspaceSnapshot = {
  account: AmbientAccount
  draft: AgentDraftModel | null
  savedAmbients: readonly SavedAmbientRecord[]
}

export interface AmbientWorkspaceService {
  getSnapshot: () => AmbientWorkspaceSnapshot
  getServerSnapshot: () => AmbientWorkspaceSnapshot
  subscribe: (listener: () => void) => () => void
  signIn: () => void
  signOut: () => void
  beginAmbient: () => void
  createAmbient: (ambientName: string, designDirection: string) => void
  copyPrompt: () => void
  renewAgentAccess: () => void
  retryConnection: () => void
  savePrivateVersion: () => Promise<SavedAmbientRecord | null>
}
