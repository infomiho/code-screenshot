import { afterEach, describe, expect, it, vi } from 'vitest'
import { createReconnectingSseConnection } from '../../src/realtime/sse/reconnecting-client'

const createResponseStream = () => {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined
  const body = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value
    },
  })
  return {
    response: new Response(body),
    write: (value: string) => controller?.enqueue(new TextEncoder().encode(value)),
    close: () => controller?.close(),
  }
}

afterEach(() => vi.useRealTimers())

describe('reconnecting SSE client', () => {
  it('becomes ready only after the ready event and reconnects after closure', async () => {
    vi.useFakeTimers()
    const first = createResponseStream()
    const second = createResponseStream()
    const open = vi.fn().mockResolvedValueOnce(first.response).mockResolvedValueOnce(second.response)
    const onReady = vi.fn()
    const onEvent = vi.fn()
    const onUnavailable = vi.fn()
    const connection = createReconnectingSseConnection({
      openResponse: open,
      readyEvent: 'ready',
      onReady,
      onEvent,
      onUnavailable,
    })

    first.write('event: ambient.changed\ndata: {}\n\n')
    await vi.advanceTimersByTimeAsync(0)
    expect(connection.ready).toBe(false)
    expect(onEvent).not.toHaveBeenCalled()

    first.write('event: ready\ndata: {}\n\nevent: ambient.changed\ndata: {}\n\n')
    await vi.advanceTimersByTimeAsync(0)
    expect(connection.ready).toBe(true)
    expect(onReady).toHaveBeenCalledOnce()
    expect(onEvent).toHaveBeenCalledOnce()

    first.close()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(onUnavailable).toHaveBeenCalledOnce()
    expect(open).toHaveBeenCalledTimes(2)
    connection.stop()
  })
})
