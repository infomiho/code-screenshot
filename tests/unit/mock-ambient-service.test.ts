import { afterEach, describe, expect, it, vi } from 'vitest'
import { MockAmbientService } from '../../src/ambient-workspace/mock-ambient-service'

const createService = () => new MockAmbientService({ agentUpdate: 0, save: 0 })

afterEach(() => {
  vi.useRealTimers()
})

describe('MockAmbientService', () => {
  it('continues a saved agent session with another version', async () => {
    vi.useFakeTimers()
    const service = createService()

    service.signIn()
    service.beginAmbient()
    service.createAmbient('Signal study')
    service.copyPrompt()
    await vi.runAllTimersAsync()

    expect(service.getSnapshot().draft).toMatchObject({ phase: 'review', revision: 1 })

    const firstSave = service.savePrivateVersion()
    await vi.runAllTimersAsync()
    await expect(firstSave).resolves.toMatchObject({ version: 1 })
    expect(service.getSnapshot().draft).toMatchObject({ phase: 'saved', revision: 1 })

    service.copyPrompt()
    await vi.runAllTimersAsync()
    expect(service.getSnapshot().draft).toMatchObject({ phase: 'review', revision: 2 })

    const secondSave = service.savePrivateVersion()
    await vi.runAllTimersAsync()
    await expect(secondSave).resolves.toMatchObject({ version: 2 })
    expect(service.getSnapshot().savedAmbients).toHaveLength(1)
  })

  it('retains private state and pending updates while signed out', async () => {
    vi.useFakeTimers()
    const service = new MockAmbientService({ agentUpdate: 10, save: 0 })

    service.signIn()
    service.beginAmbient()
    service.createAmbient('Signal study')
    service.copyPrompt()
    service.signOut()

    expect(service.getSnapshot()).toMatchObject({
      account: { kind: 'signed-out' },
      draft: { phase: 'handoff' },
    })

    await vi.advanceTimersByTimeAsync(10)
    expect(service.getSnapshot().draft).toMatchObject({ phase: 'review', revision: 1 })

    service.signIn()
    expect(service.getSnapshot()).toMatchObject({
      account: { kind: 'signed-in' },
      draft: { phase: 'review', revision: 1 },
    })
  })
})
