import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPollingFallback } from '../../src/realtime/sync/polling-fallback'

afterEach(() => vi.useRealTimers())

describe('polling fallback', () => {
  it('polls only while started and allowed', async () => {
    vi.useFakeTimers()
    let active = true
    const poll = vi.fn().mockResolvedValue(undefined)
    const polling = createPollingFallback({
      poll,
      intervalMs: 100,
      shouldPoll: () => active,
    })

    polling.start()
    await vi.advanceTimersByTimeAsync(200)
    expect(poll).toHaveBeenCalledTimes(2)

    active = false
    await vi.advanceTimersByTimeAsync(100)
    expect(poll).toHaveBeenCalledTimes(2)

    polling.pause()
    active = true
    await vi.advanceTimersByTimeAsync(500)
    expect(poll).toHaveBeenCalledTimes(2)
  })
})
