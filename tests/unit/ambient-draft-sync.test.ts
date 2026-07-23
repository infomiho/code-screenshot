import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const clientApi = vi.hoisted(() => ({ api: { get: vi.fn() } }))

vi.mock('wasp/client/api', () => clientApi)

import { startAmbientDraftSync } from '../../src/ambient/management/ambient-draft-sync'

const createStream = () => {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined
  const stream = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value
    },
  })
  return {
    response: new Response(stream, { status: 200 }),
    write: (value: string) => controller?.enqueue(new TextEncoder().encode(value)),
  }
}

describe('ambient draft sync', () => {
  beforeEach(() => {
    clientApi.api.get.mockReset()
    vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }))
    vi.stubGlobal('window', new EventTarget())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not poll while the event stream is ready', async () => {
    vi.useFakeTimers()
    const stream = createStream()
    clientApi.api.get.mockResolvedValue(stream.response)
    const sync = vi.fn().mockResolvedValue(undefined)
    const stop = startAmbientDraftSync({ ambientId: 'ambient-1', syncDraft: sync })
    stream.write('event: ready\ndata: {}\n\n')
    await vi.advanceTimersByTimeAsync(0)
    expect(sync).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(30_000)
    expect(sync).toHaveBeenCalledTimes(1)
    stop()
  })

  it('falls back to polling when the stream never becomes ready', async () => {
    vi.useFakeTimers()
    clientApi.api.get.mockImplementation(
      (_path: string, options: { signal?: AbortSignal }) => new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      }),
    )
    const sync = vi.fn().mockResolvedValue(undefined)
    const stop = startAmbientDraftSync({ ambientId: 'ambient-1', syncDraft: sync })

    await vi.advanceTimersByTimeAsync(10_000)
    expect(sync).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1_500)
    expect(sync).toHaveBeenCalledTimes(2)
    stop()
  })

  it('retries a failed ready sync through fallback polling', async () => {
    vi.useFakeTimers()
    const stream = createStream()
    clientApi.api.get
      .mockResolvedValueOnce(stream.response)
      .mockReturnValue(new Promise(() => {}))
    const sync = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined)
    const stop = startAmbientDraftSync({ ambientId: 'ambient-1', syncDraft: sync })
    stream.write('event: ready\ndata: {}\n\n')

    await vi.advanceTimersByTimeAsync(1_500)
    expect(sync).toHaveBeenCalledTimes(2)
    stop()
  })
})
