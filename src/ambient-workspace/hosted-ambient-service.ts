import { githubSignInUrl, logout } from 'wasp/client/auth'
import {
  createAmbient as createAmbientOperation,
  createAmbientAgentSession,
  getAmbientDraft,
  getAmbientDraftRevision,
  getAmbientWorkspace,
  publishAmbient,
} from 'wasp/client/operations'
import type {
  AgentDraftModel,
  AgentNotice,
  AmbientWorkspaceService,
  AmbientWorkspaceSnapshot,
  SavedAmbientRecord,
} from './ambient-workspace-service'
import type { AgentSessionDto, WorkspaceSnapshotDto } from './contracts'
import { createMinimalDraftDocument } from './minimal-draft'

const signedOutSnapshot: AmbientWorkspaceSnapshot = {
  account: { kind: 'signed-out' },
  draft: null,
  savedAmbients: [],
}

const sessionStorageKey = 'codeshot.agent-session'

const createSetupDraft = (): AgentDraftModel => ({
  id: 'ambient-pending',
  phase: 'setup',
  notice: null,
  ambientName: null,
  agentSessionUrl: null,
  agentSessionGeneration: null,
  promptCopied: false,
  promptExpiresAt: null,
  saveState: 'idle',
  revision: 0,
  document: createMinimalDraftDocument(),
})

const readCachedSession = () => {
  try {
    const value = globalThis.sessionStorage?.getItem(sessionStorageKey)
    if (!value) return null
    const session = JSON.parse(value) as AgentSessionDto
    return new Date(session.expiresAt) > new Date() ? session : null
  } catch {
    return null
  }
}

const cacheSession = (session: AgentSessionDto | null) => {
  try {
    if (!globalThis.sessionStorage) return false
    if (session) globalThis.sessionStorage.setItem(sessionStorageKey, JSON.stringify(session))
    else globalThis.sessionStorage.removeItem(sessionStorageKey)
    return true
  } catch {
    return false
  }
}

const storeAgentSession = (session: AgentSessionDto) => {
  const isAvailable = cacheSession(session)
  return {
    notice: isAvailable ? null : 'unavailable' as const,
    agentSessionUrl: isAvailable ? session.url : null,
    agentSessionGeneration: session.generation,
    promptExpiresAt: session.expiresAt,
  }
}

const getCachedSessionForDraft = (
  session: AgentSessionDto | null,
  draft: WorkspaceSnapshotDto['draft'],
) => {
  if (!session || !draft) return null
  return session.ambientId === draft.id && session.generation === draft.agentSessionGeneration
    ? session
    : null
}

const toSnapshot = (workspace: WorkspaceSnapshotDto): AmbientWorkspaceSnapshot => {
  const cachedSession = readCachedSession()
  const activeSession = getCachedSessionForDraft(cachedSession, workspace.draft)
  return {
    ...workspace,
    draft: workspace.draft
      ? {
          ...workspace.draft,
          notice: activeSession ? null : 'unavailable',
          agentSessionUrl: activeSession?.url ?? null,
          promptExpiresAt: activeSession
            ? activeSession.expiresAt
            : workspace.draft.promptExpiresAt,
          promptCopied: false,
          saveState: 'idle',
        }
      : null,
  }
}

export class HostedAmbientService implements AmbientWorkspaceService {
  private snapshot: AmbientWorkspaceSnapshot = signedOutSnapshot
  private listeners = new Set<() => void>()
  private pollingTimer: ReturnType<typeof setInterval> | null = null
  private isPolling = false
  private isCreating = false
  private isRenewingAgentAccess = false
  private requestGeneration = 0

  getSnapshot = () => this.snapshot
  getServerSnapshot = () => signedOutSnapshot

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    if (this.listeners.size === 1) void this.refresh()
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) {
        this.requestGeneration += 1
        this.stopPolling()
      }
    }
  }

  private update = (snapshot: AmbientWorkspaceSnapshot) => {
    this.snapshot = snapshot
    this.listeners.forEach((listener) => listener())
  }

  private updateDraft = (update: (draft: AgentDraftModel) => AgentDraftModel) => {
    if (!this.snapshot.draft) return
    this.update({
      ...this.snapshot,
      draft: update(this.snapshot.draft),
    })
  }

  private refresh = async () => {
    const generation = ++this.requestGeneration
    try {
      const workspace = await getAmbientWorkspace()
      if (generation !== this.requestGeneration) return
      const snapshot = toSnapshot(workspace)
      this.update(snapshot)
      if (snapshot.draft?.agentSessionUrl && snapshot.draft.phase !== 'setup') {
        this.startPolling()
      }
    } catch (error) {
      if (generation !== this.requestGeneration) return
      this.stopPolling()
      if (this.getStatusCode(error) === 401) {
        this.update(signedOutSnapshot)
      } else {
        this.updateDraft((draft) => ({ ...draft, notice: 'offline' }))
      }
    }
  }

  private getStatusCode = (error: unknown) => {
    if (!error || typeof error !== 'object' || !('statusCode' in error)) return null
    return typeof error.statusCode === 'number' ? error.statusCode : null
  }

  private getOperationNotice = (error: unknown): AgentNotice => {
    const statusCode = this.getStatusCode(error)
    return statusCode !== null && statusCode < 500 ? 'request-error' : 'offline'
  }

  private isCurrentDraft = (generation: number, ambientId: string) =>
    generation === this.requestGeneration && this.snapshot.draft?.id === ambientId

  private handleOperationError = (error: unknown, generation: number, ambientId: string) => {
    if (!this.isCurrentDraft(generation, ambientId)) return
    const statusCode = this.getStatusCode(error)
    if (statusCode === 401) {
      this.requestGeneration += 1
      this.stopPolling()
      cacheSession(null)
      this.update(signedOutSnapshot)
      return
    }
    const notice = this.getOperationNotice(error)
    this.updateDraft((draft) => ({ ...draft, notice, saveState: 'idle' }))
  }

  signIn = () => {
    globalThis.location.assign(githubSignInUrl)
  }

  signOut = () => {
    this.requestGeneration += 1
    this.stopPolling()
    cacheSession(null)
    this.update(signedOutSnapshot)
    void logout()
  }

  beginAmbient = () => {
    if (this.snapshot.account.kind !== 'signed-in') return
    this.requestGeneration += 1
    this.stopPolling()
    this.update({ ...this.snapshot, draft: createSetupDraft() })
  }

  createAmbient = async (ambientName: string) => {
    if (this.isCreating || this.snapshot.account.kind !== 'signed-in') return
    this.isCreating = true
    const generation = this.requestGeneration
    const setupDocument = this.snapshot.draft?.document ?? createMinimalDraftDocument(ambientName)
    try {
      const { ambientId, session } = await createAmbientOperation({ name: ambientName })
      if (!this.isCurrentDraft(generation, 'ambient-pending')) return
      const agentAccess = storeAgentSession(session)
      this.update({
        ...this.snapshot,
        draft: {
          id: ambientId,
          phase: 'handoff',
          notice: agentAccess.notice,
          ambientName,
          agentSessionUrl: agentAccess.agentSessionUrl,
          agentSessionGeneration: agentAccess.agentSessionGeneration,
          promptCopied: false,
          promptExpiresAt: agentAccess.promptExpiresAt,
          saveState: 'idle',
          revision: 0,
          document: { ...setupDocument, name: ambientName },
        },
      })
    } catch (error) {
      this.handleOperationError(error, generation, 'ambient-pending')
    } finally {
      this.isCreating = false
    }
  }

  copyPrompt = () => {
    const draft = this.snapshot.draft
    if (!draft?.agentSessionUrl || draft.notice === 'expired') return
    this.updateDraft((current) => ({ ...current, promptCopied: true }))
    this.startPolling()
  }

  renewAgentAccess = async () => {
    const draft = this.snapshot.draft
    if (!draft || draft.id === 'ambient-pending' || this.isRenewingAgentAccess) return
    this.isRenewingAgentAccess = true
    const generation = this.requestGeneration
    try {
      const session = await createAmbientAgentSession({ ambientId: draft.id })
      if (!this.isCurrentDraft(generation, draft.id)) return
      const currentGeneration = this.snapshot.draft?.agentSessionGeneration ?? -1
      if (session.generation <= currentGeneration) return
      const agentAccess = storeAgentSession(session)
      this.updateDraft((current) => ({
        ...current,
        notice: agentAccess.notice,
        agentSessionUrl: agentAccess.agentSessionUrl,
        agentSessionGeneration: agentAccess.agentSessionGeneration,
        promptCopied: false,
        promptExpiresAt: agentAccess.promptExpiresAt,
      }))
      this.startPolling()
    } catch (error) {
      this.handleOperationError(error, generation, draft.id)
    } finally {
      this.isRenewingAgentAccess = false
    }
  }

  retryConnection = () => {
    void this.refresh()
  }

  savePrivateVersion = async () => {
    const draft = this.snapshot.draft
    if (!draft?.document || draft.saveState === 'saving') return null
    const generation = this.requestGeneration
    this.updateDraft((current) => ({ ...current, saveState: 'saving' }))

    try {
      const version = await publishAmbient({
        ambientId: draft.id,
        draftRevision: draft.revision,
      })
      if (!this.isCurrentDraft(generation, draft.id)) return null
      const record: SavedAmbientRecord = {
        id: version.id,
        version: version.version,
        document: version.document,
      }
      const currentDraft = this.snapshot.draft
      this.update({
        ...this.snapshot,
        savedAmbients: [
          record,
          ...this.snapshot.savedAmbients.filter((candidate) => candidate.id !== record.id),
        ],
        draft: currentDraft?.revision === draft.revision
          ? { ...currentDraft, phase: 'saved', saveState: 'idle' }
          : currentDraft,
      })
      return record
    } catch (error) {
      this.handleOperationError(error, generation, draft.id)
      return null
    }
  }

  private startPolling = () => {
    if (this.pollingTimer !== null) return
    this.pollingTimer = globalThis.setInterval(() => void this.pollDraft(), 1500)
    void this.pollDraft()
  }

  private stopPolling = () => {
    if (this.pollingTimer === null) return
    globalThis.clearInterval(this.pollingTimer)
    this.pollingTimer = null
  }

  private pollDraft = async () => {
    const draft = this.snapshot.draft
    if (!draft || draft.phase === 'setup' || this.isPolling) return
    if (draft.promptExpiresAt && new Date(draft.promptExpiresAt) <= new Date()) {
      this.stopPolling()
      this.updateDraft((current) => ({ ...current, notice: 'expired' }))
      return
    }

    this.isPolling = true
    const generation = this.requestGeneration
    try {
      const status = await getAmbientDraftRevision({ ambientId: draft.id })
      if (!this.isCurrentDraft(generation, draft.id)) return
      if (status.agentSessionGeneration !== draft.agentSessionGeneration) {
        cacheSession(null)
        this.stopPolling()
        this.updateDraft((current) => ({
          ...current,
          notice: 'unavailable',
          agentSessionUrl: null,
          promptCopied: false,
        }))
        return
      }
      if (status.revision <= draft.revision) {
        if (draft.notice === 'offline') {
          this.updateDraft((current) => ({ ...current, notice: null }))
        }
        return
      }
      const latest = await getAmbientDraft({ ambientId: draft.id })
      if (!this.isCurrentDraft(generation, draft.id)) return
      this.updateDraft((current) => ({
        ...current,
        phase: 'review',
        notice: null,
        ambientName: latest.name,
        revision: latest.revision,
        document: latest.document,
        saveState: 'idle',
      }))
    } catch (error) {
      this.handleOperationError(error, generation, draft.id)
    } finally {
      this.isPolling = false
    }
  }
}
