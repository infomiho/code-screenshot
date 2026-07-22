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
  listeners.get(event.ambientId)?.forEach((listener) => listener(event))
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

const writeEvent = (
  res: { write: (chunk: string) => unknown },
  event: string,
) => {
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
  let heartbeat: ReturnType<typeof setInterval> | null = null
  let maximumLifetime: ReturnType<typeof setTimeout> | null = null
  const cleanup = () => {
    if (closed) return
    closed = true
    if (heartbeat !== null) clearInterval(heartbeat)
    if (maximumLifetime !== null) clearTimeout(maximumLifetime)
    unsubscribe()
  }
  req.once('aborted', cleanup)
  res.once('close', cleanup)

  let ambient: { id: string } | null | undefined
  try {
    ambient = context.user && await context.entities.Ambient.findFirst({
      where: { id: req.params.ambientId, ownerId: context.user.id },
      select: { id: true },
    })
  } catch (error) {
    if (closed || req.aborted || res.destroyed) return
    throw error
  }
  if (closed || req.aborted || res.destroyed) return
  if (!ambient) {
    res.status(context.user ? 404 : 401).json({ error: 'Ambient workspace not found.' })
    return
  }

  unsubscribe = subscribeToAmbient(ambient.id, () => writeEvent(res, 'ambient-change'))
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store, no-transform')
  res.setHeader('X-Accel-Buffering', 'no')
  writeEvent(res, 'ready')

  heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15_000)
  maximumLifetime = setTimeout(() => res.end(), 15 * 60_000)
}
