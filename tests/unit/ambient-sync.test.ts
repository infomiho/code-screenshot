import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const clientApi = vi.hoisted(() => ({ getSessionId: vi.fn(() => 'session-token') }))

vi.mock('wasp/client', () => ({ config: { apiUrl: 'http://localhost:3001' } }))
vi.mock('wasp/client/api', () => clientApi)

import { startAmbientSync } from '../../src/ambient-workspace/ambient-sync'

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

describe('ambient sync', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }))
    vi.stubGlobal('window', new EventTarget())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('authenticates the stream and syncs ready and change events', async () => {
    const stream = createStream()
    vi.mocked(fetch).mockResolvedValue(stream.response)
    const sync = vi.fn().mockResolvedValue(undefined)
    const stop = startAmbientSync({ ambientId: 'ambient/1', sync })

    stream.write('event: ready\ndata: {}\n\nevent: ambient-')
    stream.write('change\ndata: {"revision":2}\n\n')

    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(2))
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/ambient-workspaces/ambient%2F1/events',
      expect.objectContaining({ headers: { Authorization: 'Bearer session-token' } }),
    )
    stop()
  })

  it('coalesces invalidations while synchronization is running', async () => {
    const stream = createStream()
    vi.mocked(fetch).mockResolvedValue(stream.response)
    let finishSync: () => void = () => undefined
    const sync = vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
      finishSync = resolve
    }))
    const stop = startAmbientSync({ ambientId: 'ambient-1', sync })
    stream.write('event: ready\ndata: {}\n\n')
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(1))

    stream.write('event: ambient-change\ndata: {}\n\nevent: ambient-change\ndata: {}\n\n')
    finishSync()

    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(2))
    stop()
  })

  it('does not poll while the event stream is connected', async () => {
    vi.useFakeTimers()
    const stream = createStream()
    vi.mocked(fetch).mockResolvedValue(stream.response)
    const sync = vi.fn().mockResolvedValue(undefined)
    const stop = startAmbientSync({ ambientId: 'ambient-1', sync })
    stream.write('event: ready\ndata: {}\n\n')
    await vi.advanceTimersByTimeAsync(0)
    expect(sync).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(30_000)
    expect(sync).toHaveBeenCalledTimes(1)
    stop()
  })

  it('falls back to polling when the stream never becomes ready', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    const sync = vi.fn().mockResolvedValue(undefined)
    const stop = startAmbientSync({ ambientId: 'ambient-1', sync })

    await vi.advanceTimersByTimeAsync(10_000)
    expect(sync).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1_500)
    expect(sync).toHaveBeenCalledTimes(2)
    stop()
  })

  it('retries a failed connected sync through fallback polling', async () => {
    vi.useFakeTimers()
    const stream = createStream()
    vi.mocked(fetch)
      .mockResolvedValueOnce(stream.response)
      .mockReturnValue(new Promise(() => {}))
    const sync = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined)
    const stop = startAmbientSync({ ambientId: 'ambient-1', sync })
    stream.write('event: ready\ndata: {}\n\n')

    await vi.advanceTimersByTimeAsync(1_500)
    expect(sync).toHaveBeenCalledTimes(2)
    stop()
  })
})
