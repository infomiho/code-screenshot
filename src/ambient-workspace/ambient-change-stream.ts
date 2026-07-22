import type { MiddlewareConfigFn } from 'wasp/server'
import type { StreamAmbientChanges } from 'wasp/server/api'
import { createInMemoryBroker } from '../realtime/pubsub/broker'
import { observeSseDisconnect, openSseServerStream } from '../realtime/sse/server'
import { closeSseAfter, startSseHeartbeat } from '../realtime/sse/server-policies'
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

export const streamAmbientChanges: StreamAmbientChangesHandler = async (req, res, context) => {
  const disconnect = observeSseDisconnect(req, res)

  if (!context.user) {
    res.status(401).json({ error: 'Sign in to stream ambient changes.' })
    return
  }

  let ownedAmbient: { id: string } | null
  try {
    ownedAmbient = await context.entities.Ambient.findFirst({
      where: { id: req.params.ambientId, ownerId: context.user.id },
      select: { id: true },
    })
  } catch (error) {
    if (disconnect.closed) return
    throw error
  }
  if (disconnect.closed) return
  if (!ownedAmbient) {
    res.status(404).json({ error: 'Ambient workspace not found.' })
    return
  }

  const { id: ambientId } = ownedAmbient
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
