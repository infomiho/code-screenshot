import { openWaspSseResponse } from '../realtime/sse/adapters/wasp-client'
import { startBrowserSseRefresh } from '../realtime/sync/browser-sse-refresh'
import { ambientChangedEventName } from './ambient-change-events'

type AmbientDraftSyncOptions = {
  ambientId: string
  syncDraft: () => Promise<void>
}

export const startAmbientDraftSync = ({ ambientId, syncDraft }: AmbientDraftSyncOptions) => {
  return startBrowserSseRefresh({
    openResponse: (signal) => openWaspSseResponse(
      `/ambient-workspaces/${encodeURIComponent(ambientId)}/events`,
      signal,
    ),
    refreshEvent: ambientChangedEventName,
    refresh: syncDraft,
  })
}
