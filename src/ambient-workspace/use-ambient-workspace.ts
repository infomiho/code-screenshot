import { useMemo, useState, useSyncExternalStore } from 'react'
import { loadAmbientDefinition } from '../ambient-registry'
import { ambientDefinitions } from '../ambient-themes'
import type { AmbientWorkspaceService, SavedAmbientRecord } from './ambient-workspace-service'
import { HostedAmbientService } from './hosted-ambient-service'

export function useAmbientWorkspace(providedService?: AmbientWorkspaceService) {
  const [service] = useState(() => providedService ?? new HostedAmbientService())
  const storedSnapshot = useSyncExternalStore(
    service.subscribe,
    service.getSnapshot,
    service.getServerSnapshot,
  )
  const snapshot = useMemo(
    () => storedSnapshot.account.kind === 'signed-in'
      ? storedSnapshot
      : { ...storedSnapshot, ownedAmbients: [], workspace: null },
    [storedSnapshot],
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

  return { definitions, draftDefinitions, workspaceDefinition, service, snapshot }
}
