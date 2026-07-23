import { beforeEach, describe, expect, it, vi } from 'vitest'
import { swissPosterDocument } from '../../src/swiss-poster'

vi.mock('wasp/server', () => ({
  HttpError: class HttpError extends Error {
    constructor(public statusCode: number, message: string) {
      super(message)
    }
  },
  prisma: {},
}))

import {
  getSharedAmbient,
  setAmbientLinkSharing,
} from '../../src/ambient-workspace/ambient-operations'

const currentVersion = {
  id: 'version-2',
  version: 2,
  draftRevision: 4,
  document: swissPosterDocument,
  createdAt: new Date('2026-07-23T12:00:00.000Z'),
}

describe('ambient link sharing operations', () => {
  const findAmbient = vi.fn()
  const updateAmbient = vi.fn()
  const updateManyAmbients = vi.fn()
  const findVersion = vi.fn()
  const context = {
    user: { id: 'owner-1' },
    entities: {
      Ambient: { findFirst: findAmbient, update: updateAmbient, updateMany: updateManyAmbients },
      AmbientVersion: { findUnique: findVersion },
    },
  }

  beforeEach(() => vi.clearAllMocks())

  it('requires the owner to change link sharing', async () => {
    await expect(setAmbientLinkSharing(
      { ambientId: 'ambient-1', enabled: true },
      { ...context, user: undefined } as never,
    )).rejects.toMatchObject({ statusCode: 401 })

    findAmbient.mockResolvedValue(null)
    await expect(setAmbientLinkSharing(
      { ambientId: 'ambient-1', enabled: true },
      context as never,
    )).rejects.toMatchObject({ statusCode: 404 })
    expect(findAmbient).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ambient-1', ownerId: 'owner-1' },
    }))
  })

  it('requires a saved version before link sharing is enabled', async () => {
    findAmbient.mockResolvedValue({ id: 'ambient-1', currentVersion: null, shareId: null })

    await expect(setAmbientLinkSharing(
      { ambientId: 'ambient-1', enabled: true },
      context as never,
    )).rejects.toMatchObject({ statusCode: 409 })
    expect(updateAmbient).not.toHaveBeenCalled()
  })

  it('retains the share ID while access is turned off and back on', async () => {
    findAmbient.mockResolvedValue({ id: 'ambient-1', currentVersion: 2, shareId: 'stable-share-id-123456' })
    updateAmbient
      .mockResolvedValueOnce({ linkSharingEnabled: false, shareId: 'stable-share-id-123456' })
      .mockResolvedValueOnce({ linkSharingEnabled: true, shareId: 'stable-share-id-123456' })

    await setAmbientLinkSharing({ ambientId: 'ambient-1', enabled: false }, context as never)
    await setAmbientLinkSharing({ ambientId: 'ambient-1', enabled: true }, context as never)

    expect(updateAmbient).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: { linkSharingEnabled: false },
    }))
    expect(updateAmbient).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: { linkSharingEnabled: true },
    }))
  })

  it('keeps the winning share ID when concurrent tabs enable sharing', async () => {
    findAmbient.mockResolvedValue({ id: 'ambient-1', currentVersion: 2, shareId: null })
    updateManyAmbients.mockResolvedValue({ count: 0 })
    updateAmbient.mockResolvedValue({ linkSharingEnabled: true, shareId: 'winning-share-id-12345' })

    const result = await setAmbientLinkSharing(
      { ambientId: 'ambient-1', enabled: true },
      context as never,
    )

    expect(updateManyAmbients).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ambient-1', shareId: null },
      data: expect.objectContaining({ linkSharingEnabled: true }),
    }))
    expect(updateAmbient).toHaveBeenCalledWith(expect.objectContaining({
      data: { linkSharingEnabled: true },
    }))
    expect(result).toEqual({ enabled: true, shareId: 'winning-share-id-12345' })
  })

  it('returns only the current version for an enabled share ID', async () => {
    findAmbient.mockResolvedValue({ id: 'ambient-1', slug: 'signal-study', currentVersion: 2 })
    findVersion.mockResolvedValue(currentVersion)

    const result = await getSharedAmbient(
      { shareId: 'stable-share-id-123456' },
      { ...context, user: undefined } as never,
    )

    expect(findAmbient).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        shareId: 'stable-share-id-123456',
        linkSharingEnabled: true,
        currentVersion: { not: null },
      },
    }))
    expect(findVersion).toHaveBeenCalledWith({
      where: { ambientId_version: { ambientId: 'ambient-1', version: 2 } },
    })
    expect(result).toMatchObject({ id: 'ambient-1', slug: 'signal-study', version: { version: 2 } })
  })

  it('does not reveal disabled, unknown, or malformed share IDs', async () => {
    findAmbient.mockResolvedValue(null)
    await expect(getSharedAmbient(
      { shareId: 'stable-share-id-123456' },
      context as never,
    )).rejects.toMatchObject({ statusCode: 404 })

    await expect(getSharedAmbient(
      { shareId: 'short' },
      context as never,
    )).rejects.toMatchObject({ statusCode: 400 })
  })
})
