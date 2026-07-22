import { describe, expect, it, vi } from 'vitest'
import { createCoalescedTaskRunner } from '../../src/realtime/sync/coalesced-task-runner'

describe('coalesced task runner', () => {
  it('runs one task at a time and coalesces requested runs', async () => {
    let finish: () => void = () => undefined
    const run = vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
      finish = resolve
    }))
    const runner = createCoalescedTaskRunner(run)

    const first = runner.requestRun()
    void runner.requestRun()
    void runner.requestRun()
    expect(run).toHaveBeenCalledOnce()

    finish()
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2))
    finish()
    await first
  })

  it('reports failures without disabling future invalidations', async () => {
    const error = new Error('offline')
    const onError = vi.fn()
    const run = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined)
    const runner = createCoalescedTaskRunner(run, onError)

    await runner.requestRun()
    await runner.requestRun()

    expect(onError).toHaveBeenCalledWith(error)
    expect(run).toHaveBeenCalledTimes(2)
  })
})
