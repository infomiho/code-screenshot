import { describe, expect, it, vi } from 'vitest'
import { consumeSseResponse } from '../../src/realtime/sse/client'

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

describe('SSE client transport', () => {
  it('consumes parsed events from an open response', async () => {
    const stream = createResponseStream()
    const onEvent = vi.fn()
    const consuming = consumeSseResponse(stream.response, { onEvent })

    stream.write('event: ambient.')
    stream.write('changed\ndata: {}\n\n')
    stream.close()
    await consuming

    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: 'ambient.changed',
      data: '{}',
    }))
  })

  it('rejects unsuccessful responses before reading them', async () => {
    await expect(consumeSseResponse(
      new Response(null, { status: 401 }),
      { onEvent: () => undefined },
    )).rejects.toThrow('failed with 401')
  })

  it('stops consuming when aborted', async () => {
    const stream = createResponseStream()
    const controller = new AbortController()
    const onEvent = vi.fn()
    const consuming = consumeSseResponse(stream.response, { signal: controller.signal, onEvent })

    controller.abort()
    await consuming
    expect(onEvent).not.toHaveBeenCalled()
  })
})
