import { consumeSseResponse } from './client'
import type { SseEvent } from './protocol'

export type ReconnectingSseConnection = {
  readonly ready: boolean
  pause: () => void
  resume: () => void
  reconnect: () => void
  reconnectNow: () => void
  stop: () => void
}

export type ReconnectingSseConnectionOptions = {
  openResponse: (signal: AbortSignal) => Promise<Response>
  onReady: () => void
  onEvent: (event: SseEvent) => void
  onUnavailable: () => void
  readyEvent?: string
  readyTimeoutMs?: number
  reconnectDelayMs?: number
  maxReconnectDelayMs?: number
  autoStart?: boolean
}

export const createReconnectingSseConnection = ({
  openResponse,
  onReady,
  onEvent,
  onUnavailable,
  readyEvent,
  readyTimeoutMs = 10_000,
  reconnectDelayMs = 1_000,
  maxReconnectDelayMs = 30_000,
  autoStart = true,
}: ReconnectingSseConnectionOptions): ReconnectingSseConnection => {
  let stopped = false
  let paused = !autoStart
  let ready = false
  let activeConnectionController: AbortController | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let nextReconnectDelayMs = reconnectDelayMs

  const clearReconnectTimer = () => {
    if (reconnectTimer !== null) clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  const abortActiveConnection = () => {
    const controller = activeConnectionController
    activeConnectionController = null
    ready = false
    controller?.abort()
  }

  const scheduleReconnect = () => {
    if (stopped || paused || activeConnectionController || reconnectTimer !== null) return
    const delayMs = nextReconnectDelayMs
    nextReconnectDelayMs = Math.min(nextReconnectDelayMs * 2, maxReconnectDelayMs)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delayMs)
  }

  const connect = () => {
    if (stopped || paused || activeConnectionController) return
    clearReconnectTimer()
    const controller = new AbortController()
    activeConnectionController = controller
    const isCurrentAttempt = () => activeConnectionController === controller
    const readyTimeoutTimer = readyEvent === undefined
      ? null
      : setTimeout(() => controller.abort(), readyTimeoutMs)

    const markReady = () => {
      if (ready || stopped || !isCurrentAttempt()) return
      ready = true
      nextReconnectDelayMs = reconnectDelayMs
      if (readyTimeoutTimer !== null) clearTimeout(readyTimeoutTimer)
      onReady()
    }

    void openResponse(controller.signal)
      .then(async (response) => {
        if (!isCurrentAttempt()) return
        if (readyEvent === undefined) markReady()
        await consumeSseResponse(response, {
          signal: controller.signal,
          onEvent: (event) => {
            if (!isCurrentAttempt() || stopped) return
            if (!ready && event.event === readyEvent) markReady()
            else if (ready) onEvent(event)
          },
        })
      })
      .catch(() => undefined)
      .finally(() => {
        if (readyTimeoutTimer !== null) clearTimeout(readyTimeoutTimer)
        if (!isCurrentAttempt()) return
        activeConnectionController = null
        ready = false
        if (!stopped && !paused) {
          onUnavailable()
          scheduleReconnect()
        }
      })
  }

  const connection: ReconnectingSseConnection = {
    get ready() {
      return ready
    },
    pause: () => {
      if (stopped || paused) return
      paused = true
      clearReconnectTimer()
      abortActiveConnection()
    },
    resume: () => {
      if (stopped) return
      paused = false
      connect()
    },
    reconnect: () => {
      if (stopped || paused) return
      abortActiveConnection()
      clearReconnectTimer()
      scheduleReconnect()
    },
    reconnectNow: () => {
      if (stopped || paused) return
      abortActiveConnection()
      clearReconnectTimer()
      connect()
    },
    stop: () => {
      if (stopped) return
      stopped = true
      clearReconnectTimer()
      abortActiveConnection()
    },
  }

  if (autoStart) connect()
  return connection
}
