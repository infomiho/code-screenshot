import { openWaspSseResponse } from '../../realtime/sse/adapters/wasp-client'
import { startBrowserSseRefresh } from '../../realtime/sync/browser-sse-refresh'
import { ambientChangedEventName } from './ambient-change-events'
import { guestTokenHeader } from './contracts'

type AmbientDraftSyncOptions = {
  ambientId: string
  guestToken?: string | null
  syncDraft: () => Promise<void>
}

export const startAmbientDraftSync = ({ ambientId, guestToken, syncDraft }: AmbientDraftSyncOptions) => {
  return startBrowserSseRefresh({
    openResponse: (signal) => openWaspSseResponse(
      `/ambient-workspaces/${encodeURIComponent(ambientId)}/events`,
      signal,
      guestToken ? { [guestTokenHeader]: guestToken } : undefined,
    ),
    refreshEvent: ambientChangedEventName,
    refresh: syncDraft,
  })
}
