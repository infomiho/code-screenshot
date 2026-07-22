import { githubSignInUrl, logout } from 'wasp/client/auth'
import {
  createAgentAccess as createAgentAccessOperation,
  createAmbient as createAmbientOperation,
  createDraftFromVersion as createDraftFromVersionOperation,
  deleteAmbient as deleteAmbientOperation,
  discardAgentAccess as discardAgentAccessOperation,
  discardAmbientDraft as discardAmbientDraftOperation,
  getAmbientWorkspace,
  listOwnedAmbients,
  saveAmbientVersion as saveAmbientVersionOperation,
  syncAmbientDraft,
} from 'wasp/client/operations'
import type {
  AmbientWorkspaceService,
  AmbientWorkspaceSnapshot,
  OpenAmbientWorkspace,
  SavedAmbientRecord,
} from './ambient-workspace-service'
import { deriveDraftStatus } from './contracts'
import type { AgentSessionDto, AmbientWorkspaceDto } from './contracts'
import { startAmbientDraftSync } from './ambient-draft-sync'

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
  private stopAmbientDraftSync: (() => void) | null = null
  private accessExpiryTimer: ReturnType<typeof setTimeout> | null = null
  private syncGeneration = 0
  private requestGeneration = 0

  getSnapshot = () => this.snapshot
  getServerSnapshot = () => loadingSnapshot

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    if (this.listeners.size === 1) {
      void this.refreshLibrary()
      this.startSync()
    }
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) {
        this.stopSync()
      }
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

  private finishMutation = (ambientId: string, mutation: OpenAmbientWorkspace['mutation']) => {
    if (
      this.snapshot.workspace?.ambient.id !== ambientId
      || this.snapshot.workspace.mutation !== mutation
    ) return
    this.updateWorkspace((workspace) => ({ ...workspace, mutation: 'idle' }))
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
      this.stopSync()
      this.update(signedOutSnapshot)
      return
    }
    this.updateWorkspace((workspace) => ({
      ...workspace,
      connectivity: this.getStatusCode(error) !== null ? 'request-error' : 'offline',
    }))
  }

  signIn = () => globalThis.location.assign(githubSignInUrl)

  signOut = async () => {
    this.requestGeneration += 1
    this.stopSync()
    clearCachedSessions()
    this.update(signedOutSnapshot)
    try {
      // Awaiting keeps the session invalidated before callers navigate, so the
      // next page's account fetch cannot race a still-valid session.
      await logout()
    } catch {
      // Wasp clears local session data even when the server call fails.
    }
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
    this.stopSync()
    try {
      const workspace = await getAmbientWorkspace({ ambientId })
      if (generation !== this.requestGeneration) return false
      const openWorkspace = toOpenWorkspace(workspace, this.snapshot.workspace)
      this.update({ ...this.snapshot, workspace: openWorkspace })
      if (openWorkspace.agentAccess.status === 'available') this.startSync()
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
    this.stopSync()
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
    this.stopSync()
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
    } finally {
      this.finishMutation(workspace.ambient.id, 'creating-access')
      this.startSync()
    }
  }

  discardAgentAccess = async () => {
    const workspace = this.snapshot.workspace
    if (!workspace) return false
    const generation = this.requestGeneration
    this.stopSync()
    try {
      await discardAgentAccessOperation({ ambientId: workspace.ambient.id })
      if (!this.isCurrentWorkspaceRequest(generation, workspace.ambient.id)) return false
      cacheSession(null, workspace.ambient.id)
      await this.openWorkspace(workspace.ambient.id)
      return true
    } catch (error) {
      if (this.isCurrentWorkspaceRequest(generation, workspace.ambient.id)) this.handleError(error)
      return false
    } finally {
      this.startSync()
    }
  }

  copyPrompt = () => {
    const workspace = this.snapshot.workspace
    if (!workspace?.agentAccessUrl) return
    this.updateWorkspace((current) => ({ ...current, promptCopied: true }))
    this.startSync()
  }

  saveAmbientVersion = async () => {
    const workspace = this.snapshot.workspace
    if (!workspace?.workingDraft || workspace.mutation !== 'idle') return null
    const generation = this.requestGeneration
    this.stopSync()
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
    } finally {
      this.finishMutation(workspace.ambient.id, 'saving')
      this.startSync()
    }
  }

  discardAmbientDraft = async () => {
    const workspace = this.snapshot.workspace
    if (!workspace || workspace.mutation !== 'idle') return false
    const generation = this.requestGeneration
    this.stopSync()
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
    } finally {
      this.finishMutation(workspace.ambient.id, 'discarding')
      this.startSync()
    }
  }

  deleteAmbient = async (ambientId: string) => {
    if (this.snapshot.account.kind !== 'signed-in') return false
    const generation = this.requestGeneration
    try {
      await deleteAmbientOperation({ ambientId })
      if (generation !== this.requestGeneration) return false
      cacheSession(null, ambientId)
      if (this.snapshot.workspace?.ambient.id === ambientId) this.closeWorkspace()
      await this.refreshLibrary()
      return true
    } catch (error) {
      if (generation === this.requestGeneration) this.handleError(error)
      return false
    }
  }

  createDraftFromVersion = async (versionId: string) => {
    const workspace = this.snapshot.workspace
    if (!workspace || workspace.mutation !== 'idle') return false
    const generation = this.requestGeneration
    this.stopSync()
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
    } finally {
      this.finishMutation(workspace.ambient.id, 'restoring')
      this.startSync()
    }
  }

  private startSync = () => {
    const workspace = this.snapshot.workspace
    if (
      this.stopAmbientDraftSync
      || this.listeners.size === 0
      || !workspace
      || workspace.agentAccess.status !== 'available'
    ) return
    const syncGeneration = ++this.syncGeneration
    this.stopAmbientDraftSync = startAmbientDraftSync({
      ambientId: workspace.ambient.id,
      syncDraft: () => this.syncDraft(syncGeneration),
    })
    const accessGeneration = workspace.agentAccess.generation
    const expiresIn = Math.max(0, new Date(workspace.agentAccess.expiresAt).getTime() - Date.now())
    this.scheduleAccessExpiryRefresh(workspace.ambient.id, accessGeneration, expiresIn)
  }

  private scheduleAccessExpiryRefresh = (
    ambientId: string,
    accessGeneration: number,
    delay: number,
  ) => {
    this.accessExpiryTimer = setTimeout(() => {
      this.accessExpiryTimer = null
      const current = this.snapshot.workspace
      if (
        current?.ambient.id === ambientId
        && current.agentAccess.status === 'available'
        && current.agentAccess.generation === accessGeneration
      ) {
        void this.openWorkspace(ambientId).then((opened) => {
          const latest = this.snapshot.workspace
          if (
            !opened
            && latest?.ambient.id === ambientId
            && latest.agentAccess.status === 'available'
            && latest.agentAccess.generation === accessGeneration
          ) this.closeWorkspace()
        }).catch(() => {
          const latest = this.snapshot.workspace
          if (
            this.listeners.size > 0
            && latest?.ambient.id === ambientId
            && latest.agentAccess.status === 'available'
            && latest.agentAccess.generation === accessGeneration
          ) this.scheduleAccessExpiryRefresh(ambientId, accessGeneration, 30_000)
        })
      }
    }, delay)
  }

  private stopSync = () => {
    this.syncGeneration += 1
    this.stopAmbientDraftSync?.()
    this.stopAmbientDraftSync = null
    if (this.accessExpiryTimer !== null) clearTimeout(this.accessExpiryTimer)
    this.accessExpiryTimer = null
  }

  private syncDraft = async (syncGeneration: number) => {
    const workspace = this.snapshot.workspace
    if (!workspace?.workingDraft) return
    const generation = this.requestGeneration
    if (workspace.agentAccess.status !== 'available') {
      this.stopSync()
      return
    }
    if (new Date(workspace.agentAccess.expiresAt) <= new Date()) {
      this.stopSync()
      await this.openWorkspace(workspace.ambient.id)
      return
    }
    try {
      const result = await syncAmbientDraft({
        ambientId: workspace.ambient.id,
        knownRevision: workspace.syncToken.revision,
        knownAgentSessionGeneration: workspace.syncToken.agentSessionGeneration,
        knownCurrentVersion: workspace.syncToken.currentVersion,
      })
      if (
        syncGeneration !== this.syncGeneration
        || !this.isCurrentWorkspaceRequest(generation, workspace.ambient.id)
      ) return
      if (result.kind === 'workspace-invalidated') {
        await this.openWorkspace(workspace.ambient.id)
        return
      }
      if (result.kind === 'unchanged') {
        if (
          workspace.connectivity !== 'online'
          || result.token.revision !== workspace.syncToken.revision
          || result.token.agentSessionGeneration !== workspace.syncToken.agentSessionGeneration
          || result.token.currentVersion !== workspace.syncToken.currentVersion
        ) {
          this.updateWorkspace((current) => ({ ...current, syncToken: result.token, connectivity: 'online' }))
        }
        return
      }
      if (result.draft.revision < (this.snapshot.workspace?.workingDraft?.revision ?? -1)) return

      const currentWorkspace = this.snapshot.workspace
      if (!currentWorkspace || currentWorkspace.ambient.id !== workspace.ambient.id) return
      const draftStatus = deriveDraftStatus(
        result.draft.document,
        result.draft.acceptedChangeCount,
        currentWorkspace.versionInUse?.document ?? null,
      )
      this.update({
        ...this.snapshot,
        ownedAmbients: this.snapshot.ownedAmbients.map((ambient) => ambient.id === workspace.ambient.id
          ? {
              ...ambient,
              name: result.name,
              draft: {
                status: draftStatus,
                revision: result.draft.revision,
                document: result.draft.document,
                updatedAt: result.draft.updatedAt,
              },
            }
          : ambient),
        workspace: {
          ...currentWorkspace,
          ambient: { ...currentWorkspace.ambient, name: result.name },
          syncToken: result.token,
          workingDraft: result.draft,
          connectivity: 'online',
        },
      })
    } catch (error) {
      if (
        syncGeneration === this.syncGeneration
        && this.isCurrentWorkspaceRequest(generation, workspace.ambient.id)
      ) {
        if (this.getStatusCode(error) === 404) {
          this.closeWorkspace()
          await this.refreshLibrary()
          return
        }
        this.handleError(error)
      }
      throw error
    }
  }
}
