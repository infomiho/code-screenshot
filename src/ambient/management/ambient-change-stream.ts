import { HttpError, type MiddlewareConfigFn } from 'wasp/server'
import type { StreamAmbientChanges } from 'wasp/server/api'
import { createInMemoryBroker } from '../../realtime/pubsub/broker'
import { observeSseDisconnect, openSseServerStream } from '../../realtime/sse/server'
import { closeSseAfter, startSseHeartbeat } from '../../realtime/sse/server-policies'
import { resolveAmbientAccess } from './ambient-access'
import { guestTokenHeader } from './contracts'
import {
  ambientChangedEventName,
  type AmbientChangeNotification,
} from './ambient-change-events'

// Only the declared GET route gets the default middleware, so without this
// namespace middleware the CORS preflight (OPTIONS) would go unanswered.
export const ambientWorkspaceApiMiddleware: MiddlewareConfigFn = (middlewareConfig) => middlewareConfig

type PublishAmbientChangeInput = { ambientId: string }

const ambientChanges = createInMemoryBroker<string, AmbientChangeNotification>()

export const publishAmbientChange = ({ ambientId }: PublishAmbientChangeInput) => {
  ambientChanges.publish(ambientId, { eventName: ambientChangedEventName })
}

type StreamAmbientChangesHandler = StreamAmbientChanges<{ ambientId: string }>

// Wasp's auth middleware passes tokenless requests through, so a guest arrives here with no user.
const readGuestToken = (req: { get: (name: string) => string | undefined }) => req.get(guestTokenHeader)

export const streamAmbientChanges: StreamAmbientChangesHandler = async (req, res, context) => {
  const disconnect = observeSseDisconnect(req, res)

  let reachableAmbient: { id: string } | null
  try {
    const access = await resolveAmbientAccess(context, { guestToken: readGuestToken(req) })
    reachableAmbient = await context.entities.Ambient.findFirst({
      where: { id: req.params.ambientId, ...access.scope },
      select: { id: true },
    })
  } catch (error) {
    if (disconnect.closed) return
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message })
      return
    }
    throw error
  }
  if (disconnect.closed) return
  if (!reachableAmbient) {
    res.status(404).json({ error: 'Theme workspace not found.' })
    return
  }

  const { id: ambientId } = reachableAmbient
  const stream = openSseServerStream(req, res)
  if (stream.closed) return

  const unsubscribe = ambientChanges.subscribe(ambientId, (change) => {
    stream.sendEvent({ event: change.eventName, data: '{}' })
  })
  stream.onClose(unsubscribe)
  stream.sendEvent({ event: 'ready', data: '{}' })
  startSseHeartbeat(stream)
  closeSseAfter(stream)
}
