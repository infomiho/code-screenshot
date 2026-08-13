import { encodeSseEvent, type SseEvent } from './protocol'

type SseHttpRequest = {
  once: (event: 'aborted', listener: () => void) => unknown
  aborted: boolean
}

type SseHttpResponse = {
  once: (event: 'close', listener: () => void) => unknown
  setHeader: (name: string, value: string) => unknown
  flushHeaders?: () => unknown
  write: (chunk: string) => unknown
  end: () => unknown
  writableEnded: boolean
  destroyed: boolean
}

export const observeSseDisconnect = (req: SseHttpRequest, res: SseHttpResponse) => {
  let closed = req.aborted || res.destroyed || res.writableEnded
  const markClosed = () => {
    closed = true
  }
  req.once('aborted', markClosed)
  res.once('close', markClosed)
  return {
    get closed() {
      return closed || req.aborted || res.destroyed || res.writableEnded
    },
  }
}

export type SseServerStream = {
  readonly closed: boolean
  sendEvent: (event: SseEvent) => boolean
  sendComment: (value: string) => boolean
  onClose: (cleanup: () => void) => void
  close: () => void
}

export const openSseServerStream = (req: SseHttpRequest, res: SseHttpResponse): SseServerStream => {
  let closed = req.aborted || res.destroyed || res.writableEnded
  const cleanupTasks = new Set<() => void>()

  const cleanup = () => {
    if (closed) return
    closed = true
    cleanupTasks.forEach((task) => {
      try {
        task()
      } catch {
        // Cleanup is best effort; one failing task must not prevent the others.
      }
    })
    cleanupTasks.clear()
  }

  req.once('aborted', cleanup)
  res.once('close', cleanup)

  if (!closed) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store, no-transform')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()
  }

  const canWrite = () => !closed && !res.writableEnded && !res.destroyed
  const write = (chunk: string) => {
    if (!canWrite()) return false
    try {
      res.write(chunk)
      return true
    } catch {
      cleanup()
      return false
    }
  }

  return {
    get closed() {
      return closed || req.aborted || res.destroyed || res.writableEnded
    },
    sendEvent: (event) => write(encodeSseEvent(event)),
    sendComment: (value) => {
      if (value.includes('\n') || value.includes('\r')) throw new Error('SSE comment must not contain a newline.')
      return write(`: ${value}\n\n`)
    },
    onClose: (task) => {
      if (closed) task()
      else cleanupTasks.add(task)
    },
    close: () => {
      if (closed) return
      cleanup()
      if (!res.writableEnded && !res.destroyed) res.end()
    },
  }
}
