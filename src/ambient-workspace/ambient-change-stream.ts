import type { MiddlewareConfigFn } from 'wasp/server'
import type { StreamAmbientChanges } from 'wasp/server/api'

type AmbientChangeEvent = { ambientId: string }

export const ambientWorkspaceApiMiddleware: MiddlewareConfigFn = (middlewareConfig) => {
  const corsMiddleware = middlewareConfig.get('cors')
  return corsMiddleware ? new Map([['cors', corsMiddleware]]) : new Map()
}

type Listener = (event: AmbientChangeEvent) => void

const listeners = new Map<string, Set<Listener>>()

export const publishAmbientChange = (event: AmbientChangeEvent) => {
  listeners.get(event.ambientId)?.forEach((listener) => {
    try {
      listener(event)
    } catch {
      // One broken subscriber must not break the publisher or the other subscribers.
    }
  })
}

const subscribeToAmbient = (ambientId: string, listener: Listener) => {
  const ambientListeners = listeners.get(ambientId) ?? new Set<Listener>()
  ambientListeners.add(listener)
  listeners.set(ambientId, ambientListeners)
  return () => {
    ambientListeners.delete(listener)
    if (ambientListeners.size === 0) listeners.delete(ambientId)
  }
}

type StreamResponse = {
  write: (chunk: string) => unknown
  writableEnded: boolean
  destroyed: boolean
}

const canWrite = (res: StreamResponse) => !res.writableEnded && !res.destroyed

const writeEvent = (res: StreamResponse, event: string) => {
  if (!canWrite(res)) return
  res.write(`event: ${event}\n`)
  res.write('data: {}\n\n')
}

export const streamAmbientChanges: StreamAmbientChanges<{ ambientId: string }> = async (
  req,
  res,
  context,
) => {
  let closed = false
  let unsubscribe: () => void = () => undefined
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let maxLifetimeTimer: ReturnType<typeof setTimeout> | null = null
  const cleanup = () => {
    if (closed) return
    closed = true
    if (heartbeatTimer !== null) clearInterval(heartbeatTimer)
    if (maxLifetimeTimer !== null) clearTimeout(maxLifetimeTimer)
    unsubscribe()
  }
  req.once('aborted', cleanup)
  res.once('close', cleanup)

  if (!context.user) {
    res.status(401).json({ error: 'Sign in to stream ambient changes.' })
    return
  }

  let ambient: { id: string } | null
  try {
    ambient = await context.entities.Ambient.findFirst({
      where: { id: req.params.ambientId, ownerId: context.user.id },
      select: { id: true },
    })
  } catch (error) {
    if (closed || req.aborted || res.destroyed) return
    throw error
  }
  if (closed || req.aborted || res.destroyed) return
  if (!ambient) {
    res.status(404).json({ error: 'Ambient workspace not found.' })
    return
  }

  unsubscribe = subscribeToAmbient(ambient.id, () => writeEvent(res, 'ambient-change'))
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store, no-transform')
  res.setHeader('X-Accel-Buffering', 'no')
  writeEvent(res, 'ready')

  heartbeatTimer = setInterval(() => {
    if (canWrite(res)) res.write(': heartbeat\n\n')
  }, 15_000)
  maxLifetimeTimer = setTimeout(() => {
    cleanup()
    res.end()
  }, 15 * 60_000)
}
