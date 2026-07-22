import type { SseServerStream } from './server'

export const startSseHeartbeat = (
  stream: SseServerStream,
  intervalMs = 15_000,
) => {
  const timer = setInterval(() => stream.sendComment('heartbeat'), intervalMs)
  const stop = () => clearInterval(timer)
  stream.onClose(stop)
  return stop
}

export const closeSseAfter = (
  stream: SseServerStream,
  maxLifetimeMs = 15 * 60_000,
) => {
  const timer = setTimeout(() => stream.close(), maxLifetimeMs)
  const stop = () => clearTimeout(timer)
  stream.onClose(stop)
  return stop
}
