import { githubSignInUrl, logout } from 'wasp/client/auth'
import {
  createAgentAccess as createAgentAccessOperation,
  createAmbient as createAmbientOperation,
  createDraftFromVersion as createDraftFromVersionOperation,
  discardAgentAccess as discardAgentAccessOperation,
  discardAmbientDraft as discardAmbientDraftOperation,
  getAmbientDraftRevision,
  getAmbientWorkspace,
  listOwnedAmbients,
  saveAmbientVersion as saveAmbientVersionOperation,
} from 'wasp/client/operations'
import type {
  AmbientWorkspaceService,
  AmbientWorkspaceSnapshot,
  OpenAmbientWorkspace,
  SavedAmbientRecord,
} from './ambient-workspace-service'
import type { AgentSessionDto, AmbientWorkspaceDto } from './contracts'

const signedOutSnapshot: AmbientWorkspaceSnapshot = {
  isHydrated: true,
  libraryStatus: 'ready',
  account: { kind: 'signed-out' },
  ownedAmbients: [],
  workspace: null,
}
const loadingSnapshot: AmbientWorkspaceSnapshot = {
  ...signedOutSnapshot,
  isHydrated: false,
  libraryStatus: 'loading',
}
const sessionStoragePrefix = 'codeshot.agent-session.'

const sessionKey = (ambientId: string) => `${sessionStoragePrefix}${ambientId}`

const readCachedSession = (ambientId: string) => {
  try {
    const value = globalThis.sessionStorage?.getItem(sessionKey(ambientId))
    if (!value) return null
    const session = JSON.parse(value) as AgentSessionDto
    if (new Date(session.expiresAt) <= new Date()) return null
    return session
  } catch {
    return null
  }
}

const cacheSession = (session: AgentSessionDto | null, ambientId: string) => {
  try {
    if (!globalThis.sessionStorage) return false
    if (session) globalThis.sessionStorage.setItem(sessionKey(ambientId), JSON.stringify(session))
    else globalThis.sessionStorage.removeItem(sessionKey(ambientId))
    return true
  } catch {
    return false
  }
}

const clearCachedSessions = () => {
  try {
    if (!globalThis.sessionStorage) return
    const keys = Array.from(
      { length: globalThis.sessionStorage.length },
      (_, index) => globalThis.sessionStorage.key(index),
    )
    keys.forEach((key) => {
      if (key?.startsWith(sessionStoragePrefix)) globalThis.sessionStorage.removeItem(key)
    })
  } catch {
    // Session storage is optional; server-side revocation remains authoritative.
  }
}

const toOpenWorkspace = (
  workspace: AmbientWorkspaceDto,
  previous: OpenAmbientWorkspace | null,
): OpenAmbientWorkspace => {
  const cached = readCachedSession(workspace.ambient.id)
  const sessionMatches = cached
    && workspace.agentAccess.status === 'available'
    && cached.generation === workspace.agentAccess.generation
  return {
    ...workspace,
    agentAccessUrl: sessionMatches ? cached.url : null,
    promptCopied: previous?.ambient.id === workspace.ambient.id ? previous.promptCopied : false,
    connectivity: 'online',
    mutation: 'idle',
  }
}

export class HostedAmbientService implements AmbientWorkspaceService {
  private snapshot: AmbientWorkspaceSnapshot = loadingSnapshot
  private listeners = new Set<() => void>()
  private pollingTimer: ReturnType<typeof setInterval> | null = null
  private requestGeneration = 0
  private isPolling = false

  getSnapshot = () => this.snapshot
  getServerSnapshot = () => loadingSnapshot

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    if (this.listeners.size === 1) void this.refreshLibrary()
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) this.stopPolling()
    }
  }

  private update = (next: AmbientWorkspaceSnapshot) => {
    this.snapshot = next
    this.listeners.forEach((listener) => listener())
  }

  private updateWorkspace = (update: (workspace: OpenAmbientWorkspace) => OpenAmbientWorkspace) => {
    if (!this.snapshot.workspace) return
    this.update({ ...this.snapshot, workspace: update(this.snapshot.workspace) })
  }

  private isCurrentWorkspaceRequest = (generation: number, ambientId: string) => (
    generation === this.requestGeneration
    && this.snapshot.workspace?.ambient.id === ambientId
  )

  private getStatusCode = (error: unknown) => {
    if (!error || typeof error !== 'object' || !('statusCode' in error)) return null
    return typeof error.statusCode === 'number' ? error.statusCode : null
  }

  private handleError = (error: unknown) => {
    if (this.getStatusCode(error) === 401) {
      this.stopPolling()
      this.update(signedOutSnapshot)
      return
    }
    this.updateWorkspace((workspace) => ({
      ...workspace,
      connectivity: this.getStatusCode(error) !== null ? 'request-error' : 'offline',
      mutation: 'idle',
    }))
  }

  signIn = () => globalThis.location.assign(githubSignInUrl)

  signOut = () => {
    this.requestGeneration += 1
    this.stopPolling()
    clearCachedSessions()
    this.update(signedOutSnapshot)
    void logout()
  }

  refreshLibrary = async () => {
    const generation = ++this.requestGeneration
    try {
      const library = await listOwnedAmbients()
      if (generation !== this.requestGeneration) return
      this.update({
        ...this.snapshot,
        ...library,
        isHydrated: true,
        libraryStatus: 'ready',
        workspace: library.account.kind === 'signed-in' ? this.snapshot.workspace : null,
      })
    } catch (error) {
      if (generation !== this.requestGeneration) return
      if (this.getStatusCode(error) === 401) this.handleError(error)
      else this.update({
        ...this.snapshot,
        isHydrated: true,
        libraryStatus: this.getStatusCode(error) !== null ? 'request-error' : 'offline',
      })
    }
  }

  openWorkspace = async (ambientId: string) => {
    const generation = ++this.requestGeneration
    this.stopPolling()
    try {
      const workspace = await getAmbientWorkspace({ ambientId })
      if (generation !== this.requestGeneration) return false
      const openWorkspace = toOpenWorkspace(workspace, this.snapshot.workspace)
      this.update({ ...this.snapshot, workspace: openWorkspace })
      if (openWorkspace.agentAccess.status === 'available') this.startPolling()
      return true
    } catch (error) {
      if (generation !== this.requestGeneration) return false
      if (this.getStatusCode(error) === 404) return false
      this.handleError(error)
      throw error
    }
  }

  closeWorkspace = () => {
    this.requestGeneration += 1
    this.stopPolling()
    this.update({ ...this.snapshot, workspace: null })
  }

  createAmbient = async (ambientName: string) => {
    if (this.snapshot.account.kind !== 'signed-in') return null
    const generation = this.requestGeneration
    try {
      const { ambientId } = await createAmbientOperation({ name: ambientName })
      if (generation !== this.requestGeneration) return null
      await this.refreshLibrary()
      if (this.requestGeneration !== generation + 1) return null
      await this.openWorkspace(ambientId)
      return ambientId
    } catch (error) {
      if (generation === this.requestGeneration) this.handleError(error)
      return null
    }
  }

  createAgentAccess = async () => {
    const workspace = this.snapshot.workspace
    if (!workspace || workspace.mutation !== 'idle') return false
    const generation = this.requestGeneration
    this.updateWorkspace((current) => ({ ...current, mutation: 'creating-access' }))
    try {
      const session = await createAgentAccessOperation({ ambientId: workspace.ambient.id })
      if (!this.isCurrentWorkspaceRequest(generation, workspace.ambient.id)) return false
      const available = cacheSession(session, workspace.ambient.id)
      await this.openWorkspace(workspace.ambient.id)
      if (!available) {
        this.updateWorkspace((current) => ({ ...current, agentAccessUrl: null }))
      }
      return available
    } catch (error) {
      if (this.isCurrentWorkspaceRequest(generation, workspace.ambient.id)) this.handleError(error)
      return false
    }
  }

  discardAgentAccess = async () => {
    const workspace = this.snapshot.workspace
    if (!workspace) return false
    const generation = this.requestGeneration
    try {
      await discardAgentAccessOperation({ ambientId: workspace.ambient.id })
      if (!this.isCurrentWorkspaceRequest(generation, workspace.ambient.id)) return false
      cacheSession(null, workspace.ambient.id)
      await this.openWorkspace(workspace.ambient.id)
      return true
    } catch (error) {
      if (this.isCurrentWorkspaceRequest(generation, workspace.ambient.id)) this.handleError(error)
      return false
    }
  }

  copyPrompt = () => {
    const workspace = this.snapshot.workspace
    if (!workspace?.agentAccessUrl) return
    this.updateWorkspace((current) => ({ ...current, promptCopied: true }))
    this.startPolling()
  }

  saveAmbientVersion = async () => {
    const workspace = this.snapshot.workspace
    if (!workspace?.workingDraft || workspace.mutation !== 'idle') return null
    const generation = this.requestGeneration
    this.updateWorkspace((current) => ({ ...current, mutation: 'saving' }))
    try {
      const version = await saveAmbientVersionOperation({
        ambientId: workspace.ambient.id,
        draftRevision: workspace.workingDraft.revision,
      })
      if (!this.isCurrentWorkspaceRequest(generation, workspace.ambient.id)) return null
      await this.refreshLibrary()
      if (this.snapshot.workspace?.ambient.id !== workspace.ambient.id) return null
      await this.openWorkspace(workspace.ambient.id)
      return version as SavedAmbientRecord
    } catch (error) {
      if (this.isCurrentWorkspaceRequest(generation, workspace.ambient.id)) this.handleError(error)
      return null
    }
  }

  discardAmbientDraft = async () => {
    const workspace = this.snapshot.workspace
    if (!workspace || workspace.mutation !== 'idle') return false
    const generation = this.requestGeneration
    this.updateWorkspace((current) => ({ ...current, mutation: 'discarding' }))
    try {
      const result = await discardAmbientDraftOperation({ ambientId: workspace.ambient.id })
      if (!this.isCurrentWorkspaceRequest(generation, workspace.ambient.id)) return false
      cacheSession(null, workspace.ambient.id)
      await this.refreshLibrary()
      if (this.snapshot.workspace?.ambient.id !== workspace.ambient.id) return false
      if (result.ambientDeleted) this.closeWorkspace()
      else await this.openWorkspace(workspace.ambient.id)
      return true
    } catch (error) {
      if (this.isCurrentWorkspaceRequest(generation, workspace.ambient.id)) this.handleError(error)
      return false
    }
  }

  createDraftFromVersion = async (versionId: string) => {
    const workspace = this.snapshot.workspace
    if (!workspace || workspace.mutation !== 'idle') return false
    const generation = this.requestGeneration
    this.updateWorkspace((current) => ({ ...current, mutation: 'restoring' }))
    try {
      await createDraftFromVersionOperation({ ambientId: workspace.ambient.id, versionId })
      if (!this.isCurrentWorkspaceRequest(generation, workspace.ambient.id)) return false
      cacheSession(null, workspace.ambient.id)
      await this.refreshLibrary()
      if (this.snapshot.workspace?.ambient.id !== workspace.ambient.id) return false
      await this.openWorkspace(workspace.ambient.id)
      return true
    } catch (error) {
      if (this.isCurrentWorkspaceRequest(generation, workspace.ambient.id)) this.handleError(error)
      return false
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
    const workspace = this.snapshot.workspace
    if (!workspace?.workingDraft || this.isPolling) return
    const generation = this.requestGeneration
    if (workspace.agentAccess.status !== 'available') {
      this.stopPolling()
      return
    }
    if (new Date(workspace.agentAccess.expiresAt) <= new Date()) {
      this.stopPolling()
      await this.openWorkspace(workspace.ambient.id)
      return
    }
    this.isPolling = true
    try {
      const status = await getAmbientDraftRevision({ ambientId: workspace.ambient.id })
      if (!this.isCurrentWorkspaceRequest(generation, workspace.ambient.id)) return
      if (
        status.revision > workspace.workingDraft.revision
        || status.agentSessionGeneration !== workspace.agentAccess.generation
      ) {
        await this.openWorkspace(workspace.ambient.id)
      }
    } catch (error) {
      if (this.isCurrentWorkspaceRequest(generation, workspace.ambient.id)) this.handleError(error)
    } finally {
      this.isPolling = false
    }
  }
}
