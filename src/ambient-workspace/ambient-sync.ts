import { config } from 'wasp/client'
import { getSessionId } from 'wasp/client/api'

type AmbientSyncInput = {
  ambientId: string
  sync: () => Promise<void>
}

const pollInterval = 1_500
const streamReadyTimeout = 10_000
const maximumReconnectDelay = 30_000

const parseEventBlock = (block: string) => {
  let event = 'message'
  block.split('\n').forEach((line) => {
    if (line.startsWith('event:')) event = line.slice(6).trimStart()
  })
  return event
}

const readAmbientStream = async (
  ambientId: string,
  signal: AbortSignal,
  onReady: () => void,
  onChange: () => void,
) => {
  const sessionId = getSessionId()
  const response = await fetch(
    `${config.apiUrl}/ambient-workspaces/${encodeURIComponent(ambientId)}/events`,
    {
      headers: sessionId ? { Authorization: `Bearer ${sessionId}` } : {},
      signal,
    },
  )
  if (!response.ok) throw new Error(`Ambient event stream failed with ${response.status}.`)
  if (!response.body) throw new Error('Ambient event stream has no response body.')

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let ready = false
  while (true) {
    const { done, value } = await reader.read()
    if (done) return
    buffer = `${buffer}${value}`.replaceAll('\r\n', '\n')
    let boundary = buffer.indexOf('\n\n')
    while (boundary >= 0) {
      const event = parseEventBlock(buffer.slice(0, boundary))
      buffer = buffer.slice(boundary + 2)
      if (event === 'ready' && !ready) {
        ready = true
        onReady()
      } else if (event === 'ambient-change' && ready) {
        onChange()
      }
      boundary = buffer.indexOf('\n\n')
    }
  }
}

export const startAmbientSync = ({ ambientId, sync }: AmbientSyncInput) => {
  if (typeof document === 'undefined') return () => undefined

  let stopped = false
  let connected = false
  let reconnectDelay = 1_000
  let streamController: AbortController | null = null
  let readyTimer: ReturnType<typeof setTimeout> | null = null
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let syncPromise: Promise<void> | null = null
  let syncQueued = false

  const isVisible = () => document.visibilityState !== 'hidden'
  const clearTimer = (timer: ReturnType<typeof setTimeout> | null) => {
    if (timer !== null) clearTimeout(timer)
  }

  const clearNetworkTimers = () => {
    clearTimer(readyTimer)
    clearTimer(pollTimer)
    clearTimer(reconnectTimer)
    readyTimer = null
    pollTimer = null
    reconnectTimer = null
  }

  const abortStream = () => {
    const controller = streamController
    streamController = null
    controller?.abort()
    connected = false
    clearTimer(readyTimer)
    readyTimer = null
  }

  function requestSync(): Promise<void> {
    if (stopped || !isVisible()) return Promise.resolve()
    if (syncPromise) {
      syncQueued = true
      return syncPromise
    }

    const pending = Promise.resolve().then(sync)
    syncPromise = pending
    return pending
      .catch(() => {
        if (connected) enterDisconnected(false)
      })
      .finally(() => {
        syncPromise = null
        const runQueuedSync = syncQueued
        syncQueued = false
        if (runQueuedSync && !stopped && isVisible()) void requestSync()
        else if (!connected) schedulePoll()
      })
  }

  function schedulePoll() {
    if (stopped || connected || !isVisible() || pollTimer !== null) return
    pollTimer = setTimeout(() => {
      pollTimer = null
      void requestSync()
    }, pollInterval)
  }

  function connect() {
    if (stopped || connected || !isVisible() || streamController) return
    clearTimer(reconnectTimer)
    reconnectTimer = null
    const controller = new AbortController()
    streamController = controller
    readyTimer = setTimeout(() => controller.abort(), streamReadyTimeout)

    void readAmbientStream(
      ambientId,
      controller.signal,
      () => {
        if (stopped || streamController !== controller) return
        connected = true
        reconnectDelay = 1_000
        clearNetworkTimers()
        void requestSync()
      },
      () => {
        if (!stopped && connected && streamController === controller) void requestSync()
      },
    ).catch(() => undefined).finally(() => {
      if (streamController !== controller) return
      streamController = null
      connected = false
      clearTimer(readyTimer)
      readyTimer = null
      if (!stopped && isVisible()) enterDisconnected(true)
    })
  }

  function scheduleReconnect() {
    if (stopped || connected || !isVisible() || reconnectTimer !== null) return
    const delay = reconnectDelay
    reconnectDelay = Math.min(reconnectDelay * 2, maximumReconnectDelay)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  function enterDisconnected(syncImmediately: boolean) {
    if (stopped || !isVisible()) return
    abortStream()
    if (syncImmediately) void requestSync()
    schedulePoll()
    scheduleReconnect()
  }

  const pause = () => {
    abortStream()
    clearNetworkTimers()
    syncQueued = false
  }

  const onVisibilityChange = () => {
    if (isVisible()) connect()
    else pause()
  }
  const onOnline = () => {
    if (stopped || !isVisible() || connected) return
    abortStream()
    clearTimer(reconnectTimer)
    reconnectTimer = null
    connect()
  }
  const onPageShow = () => {
    if (stopped || !isVisible()) return
    abortStream()
    connect()
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('online', onOnline)
  window.addEventListener('pageshow', onPageShow)
  connect()

  return () => {
    if (stopped) return
    stopped = true
    syncQueued = false
    abortStream()
    clearNetworkTimers()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('pageshow', onPageShow)
  }
}
