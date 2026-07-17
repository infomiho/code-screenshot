import { useMemo, useState, useSyncExternalStore } from 'react'
import { loadAmbientDefinition } from '../ambient-registry'
import { ambientDefinitions } from '../ambient-themes'
import type {
  AmbientWorkspaceService,
  SavedAmbientRecord,
} from './ambient-workspace-service'
import { MockAmbientService } from './mock-ambient-service'

export function useAmbientWorkspace(providedService?: AmbientWorkspaceService) {
  const [service] = useState(
    () => providedService ?? new MockAmbientService(),
  )
  const storedSnapshot = useSyncExternalStore(
    service.subscribe,
    service.getSnapshot,
    service.getServerSnapshot,
  )
  const snapshot = useMemo(
    () => storedSnapshot.account.kind === 'signed-in'
      ? storedSnapshot
      : {
          account: storedSnapshot.account,
          draft: null,
          savedAmbients: [],
        },
    [storedSnapshot],
  )
  const savedDefinitions = useMemo(
    () => snapshot.savedAmbients.flatMap((record) => {
      const result = loadAmbientDefinition(record, 'saved')
      return result.definition ? [result.definition] : []
    }),
    [snapshot.savedAmbients],
  )
  const draftDefinition = useMemo(() => {
    const draft = snapshot.draft
    if (!draft?.document || draft.phase === 'saved') return null

    const record: SavedAmbientRecord = {
      id: draft.id,
      version: draft.revision,
      document: draft.document,
    }
    return loadAmbientDefinition(record, 'draft').definition
  }, [
    snapshot.draft?.document,
    snapshot.draft?.id,
    snapshot.draft?.phase,
    snapshot.draft?.revision,
  ])
  const definitions = useMemo(
    () => [
      ...ambientDefinitions,
      ...(draftDefinition ? [draftDefinition] : []),
      ...savedDefinitions.filter((definition) => definition.id !== draftDefinition?.id),
    ],
    [draftDefinition, savedDefinitions],
  )

  return { definitions, draftDefinition, service, snapshot }
}
