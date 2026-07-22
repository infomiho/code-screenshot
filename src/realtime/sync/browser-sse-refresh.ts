import { bindSseToPageLifecycle, isPageVisible } from '../browser/page-lifecycle'
import {
  createReconnectingSseConnection,
  type ReconnectingSseConnection,
} from '../sse/reconnecting-client'
import { createCoalescedTaskRunner } from './coalesced-task-runner'
import { createPollingFallback, type PollingFallback } from './polling-fallback'

export type BrowserSseRefreshOptions = {
  openResponse: (signal: AbortSignal) => Promise<Response>
  refreshEvent: string
  refresh: () => unknown | Promise<unknown>
  pollIntervalMs?: number
}

export const startBrowserSseRefresh = ({
  openResponse,
  refreshEvent,
  refresh,
  pollIntervalMs,
}: BrowserSseRefreshOptions) => {
  let connection: ReconnectingSseConnection | null = null
  let fallbackPolling: PollingFallback | null = null
  const refreshRunner = createCoalescedTaskRunner(refresh, () => {
    if (!connection?.ready) return
    fallbackPolling?.start()
    connection.reconnect()
  })

  fallbackPolling = createPollingFallback({
    poll: refreshRunner.requestRun,
    intervalMs: pollIntervalMs,
    shouldPoll: isPageVisible,
  })
  connection = createReconnectingSseConnection({
    openResponse,
    readyEvent: 'ready',
    autoStart: false,
    onReady: () => {
      fallbackPolling?.pause()
      void refreshRunner.requestRun()
    },
    onEvent: (received) => {
      if (received.event === refreshEvent) void refreshRunner.requestRun()
    },
    onUnavailable: () => {
      fallbackPolling?.start()
      void refreshRunner.requestRun()
    },
  })
  const unbindPageLifecycle = bindSseToPageLifecycle(connection)

  return () => {
    unbindPageLifecycle()
    fallbackPolling?.stop()
    refreshRunner.stop()
  }
}
