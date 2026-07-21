import { afterEach, describe, expect, it, vi } from 'vitest'
import { MockAmbientService } from '../../src/ambient-workspace/mock-ambient-service'

const createService = () => new MockAmbientService({ agentUpdate: 0, save: 0 })

afterEach(() => vi.useRealTimers())

describe('MockAmbientService', () => {
  it('retains multiple drafts and complete immutable version histories', async () => {
    vi.useFakeTimers()
    const service = createService()
    service.signIn()

    const firstId = await service.createAmbient('Signal study')
    await service.createAgentAccess()
    service.copyPrompt()
    await vi.runAllTimersAsync()
    const firstSave = service.saveAmbientVersion()
    await vi.runAllTimersAsync()
    const versionOne = await firstSave
    expect(versionOne).toMatchObject({ version: 1 })

    service.copyPrompt()
    await vi.runAllTimersAsync()
    const secondSave = service.saveAmbientVersion()
    await vi.runAllTimersAsync()
    await expect(secondSave).resolves.toMatchObject({ version: 2 })

    const secondId = await service.createAmbient('Launch frame')
    expect(service.getSnapshot().ownedAmbients).toHaveLength(2)
    expect(service.getSnapshot().ownedAmbients.every((ambient) => ambient.draft)).toBe(true)

    await service.openWorkspace(firstId!)
    expect(service.getSnapshot().workspace?.versions.map(({ version }) => version)).toEqual([2, 1])
    expect(service.getSnapshot().workspace?.versions[1].document).toEqual(versionOne?.document)
    expect(secondId).not.toBe(firstId)
  })

  it('restores an old version with a fresh revision and can save it', async () => {
    vi.useFakeTimers()
    const service = createService()
    service.signIn()
    await service.createAmbient('Signal study')
    await service.createAgentAccess()
    service.copyPrompt()
    await vi.runAllTimersAsync()
    const firstSave = service.saveAmbientVersion()
    await vi.runAllTimersAsync()
    await firstSave
    service.copyPrompt()
    await vi.runAllTimersAsync()
    const secondSave = service.saveAmbientVersion()
    await vi.runAllTimersAsync()
    await secondSave

    const firstVersionId = service.getSnapshot().workspace?.versions[1].id
    await expect(service.createDraftFromVersion(firstVersionId!)).resolves.toBe(true)
    expect(service.getSnapshot().workspace?.workingDraft).toMatchObject({
      revision: 3,
      baseRevision: 3,
      acceptedChangeCount: 0,
    })
    const restoredSave = service.saveAmbientVersion()
    await vi.runAllTimersAsync()
    await expect(restoredSave).resolves.toMatchObject({ version: 3, draftRevision: 3 })
  })

  it('expires access without discarding the draft', async () => {
    const service = createService()
    service.signIn()
    await service.createAmbient('Signal study')
    await service.createAgentAccess()
    const draft = service.getSnapshot().workspace?.workingDraft

    await service.discardAgentAccess()

    expect(service.getSnapshot().workspace?.agentAccess.status).toBe('expired')
    expect(service.getSnapshot().workspace?.workingDraft).toEqual(draft)
  })

  it('recreates a saved draft when new agent access is created', async () => {
    vi.useFakeTimers()
    const service = createService()
    service.signIn()
    await service.createAmbient('Signal study')
    await service.createAgentAccess()
    service.copyPrompt()
    await vi.runAllTimersAsync()
    const saving = service.saveAmbientVersion()
    await vi.runAllTimersAsync()
    await saving
    await service.discardAmbientDraft()

    expect(service.getSnapshot().workspace?.workingDraft).toBeNull()
    await service.createAgentAccess()

    expect(service.getSnapshot().workspace?.workingDraft).toMatchObject({
      sourceVersion: 1,
      acceptedChangeCount: 0,
    })
    expect(service.getSnapshot().workspace?.agentAccess).toMatchObject({
      status: 'available',
      generation: 2,
    })
  })

  it('deletes an ambient and closes its open workspace', async () => {
    const service = createService()
    service.signIn()
    const keptId = await service.createAmbient('Keeper')
    const deletedId = await service.createAmbient('Signal study')

    await expect(service.deleteAmbient(deletedId!)).resolves.toBe(true)

    expect(service.getSnapshot().workspace).toBeNull()
    expect(service.getSnapshot().ownedAmbients.map(({ id }) => id)).toEqual([keptId])
    await expect(service.deleteAmbient(deletedId!)).resolves.toBe(false)
    await expect(service.openWorkspace(deletedId!)).resolves.toBe(false)
  })
})
