import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SseServerStream } from '../../src/realtime/sse/server'
import { closeSseAfter, startSseHeartbeat } from '../../src/realtime/sse/server-policies'

const createStream = () => {
  const cleanupTasks: Array<() => void> = []
  const stream = {
    closed: false,
    sendEvent: vi.fn(() => true),
    sendComment: vi.fn(() => true),
    onClose: vi.fn((cleanup: () => void) => cleanupTasks.push(cleanup)),
    close: vi.fn(),
  } satisfies SseServerStream
  return {
    stream,
    disconnect: () => cleanupTasks.forEach((cleanup) => cleanup()),
  }
}

afterEach(() => vi.useRealTimers())

describe('SSE server policies', () => {
  it('sends heartbeats until the stream closes', () => {
    vi.useFakeTimers()
    const { stream, disconnect } = createStream()
    startSseHeartbeat(stream, 100)

    vi.advanceTimersByTime(200)
    expect(stream.sendComment).toHaveBeenCalledTimes(2)

    disconnect()
    vi.advanceTimersByTime(500)
    expect(stream.sendComment).toHaveBeenCalledTimes(2)
  })

  it('closes a stream after its maximum lifetime', () => {
    vi.useFakeTimers()
    const { stream, disconnect } = createStream()
    closeSseAfter(stream, 100)

    vi.advanceTimersByTime(99)
    expect(stream.close).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(stream.close).toHaveBeenCalledOnce()

    disconnect()
    vi.advanceTimersByTime(100)
    expect(stream.close).toHaveBeenCalledOnce()
  })
})
