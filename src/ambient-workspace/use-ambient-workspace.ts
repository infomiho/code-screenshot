import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { loadAmbientDefinition } from '../ambient-registry'
import { ambientDefinitions } from '../ambient-themes'
import type { AmbientWorkspaceService, SavedAmbientRecord } from './ambient-workspace-service'
import { useHostedAmbientWorkspace, type WorkspaceLoadState } from './use-hosted-ambient-workspace'

const emptySnapshot = {
  isHydrated: false,
  libraryStatus: 'loading',
  account: { kind: 'signed-out' },
  ownedAmbients: [],
  workspace: null,
} as const

const emptyService: AmbientWorkspaceService = {
  getSnapshot: () => emptySnapshot,
  getServerSnapshot: () => emptySnapshot,
  subscribe: () => () => undefined,
  signIn: () => undefined,
  signOut: async () => undefined,
  refreshLibrary: async () => undefined,
  openWorkspace: async () => false,
  closeWorkspace: () => undefined,
  createAmbient: async () => null,
  createAgentAccess: async () => false,
  discardAgentAccess: async () => false,
  copyPrompt: () => undefined,
  saveAmbientVersion: async () => null,
  discardAmbientDraft: async () => false,
  createDraftFromVersion: async () => false,
  deleteAmbient: async () => false,
  setLinkSharing: async () => false,
}

export function useAmbientWorkspace(providedService?: AmbientWorkspaceService, ambientId?: string) {
  const [injectedService] = useState(() => providedService ?? emptyService)
  const storedSnapshot = useSyncExternalStore(
    injectedService.subscribe,
    injectedService.getSnapshot,
    injectedService.getServerSnapshot,
  )
  const hosted = useHostedAmbientWorkspace(ambientId, !providedService)
  const [injectedLoadState, setInjectedLoadState] = useState<WorkspaceLoadState>(
    ambientId === 'new' ? 'setup' : 'loading',
  )
  const service = providedService ? injectedService : hosted.service
  const sourceSnapshot = providedService ? storedSnapshot : hosted.snapshot

  useEffect(() => {
    if (!providedService) return
    if (ambientId === 'new') {
      setInjectedLoadState('setup')
      return
    }
    if (!ambientId) {
      setInjectedLoadState('not-found')
      return
    }
    let active = true
    setInjectedLoadState('loading')
    void injectedService.openWorkspace(ambientId).then((opened) => {
      if (active) setInjectedLoadState(opened ? 'ready' : 'not-found')
    }).catch(() => {
      if (active) setInjectedLoadState('error')
    })
    return () => {
      active = false
    }
  }, [ambientId, injectedService, providedService])

  const snapshot = useMemo(
    () => sourceSnapshot.account.kind === 'signed-in'
      ? sourceSnapshot
      : { ...sourceSnapshot, ownedAmbients: [], workspace: null },
    [sourceSnapshot],
  )
  const savedDefinitions = useMemo(
    () => snapshot.ownedAmbients.flatMap((ambient) => {
      if (!ambient.currentVersion) return []
      const result = loadAmbientDefinition({
        ...ambient.currentVersion,
        id: ambient.id,
      }, 'saved')
      return result.definition ? [result.definition] : []
    }),
    [snapshot.ownedAmbients],
  )
  const draftDefinitions = useMemo(
    () => new Map(snapshot.ownedAmbients.flatMap((ambient) => {
      if (!ambient.draft) return []
      const result = loadAmbientDefinition({
        id: ambient.id,
        version: ambient.draft.revision,
        draftRevision: ambient.draft.revision,
        createdAt: ambient.draft.updatedAt,
        document: ambient.draft.document,
      }, 'draft')
      return result.definition ? [[ambient.id, result.definition] as const] : []
    })),
    [snapshot.ownedAmbients],
  )
  const workspaceDefinition = useMemo(() => {
    const workspace = snapshot.workspace
    if (!workspace?.workingDraft) return null
    const record: SavedAmbientRecord = {
      id: workspace.ambient.id,
      version: workspace.workingDraft.revision,
      draftRevision: workspace.workingDraft.revision,
      createdAt: workspace.workingDraft.updatedAt,
      document: workspace.workingDraft.document,
    }
    return loadAmbientDefinition(record, 'draft').definition
  }, [snapshot.workspace])
  const definitions = useMemo(
    () => [...ambientDefinitions, ...savedDefinitions],
    [savedDefinitions],
  )

  return {
    definitions,
    draftDefinitions,
    workspaceDefinition,
    service,
    snapshot,
    workspaceLoadState: providedService ? injectedLoadState : hosted.workspaceLoadState,
  }
}
