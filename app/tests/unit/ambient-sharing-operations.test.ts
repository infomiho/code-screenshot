import { beforeEach, describe, expect, it, vi } from 'vitest'
import { swissPosterDocument } from '../../src/ambient/rendering/themes/swiss-poster'

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  ambient: { create: vi.fn(), findFirst: vi.fn() },
  ambientVersion: { findUnique: vi.fn() },
  guestSession: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
}))

vi.mock('wasp/server', () => ({
  env: { ADMIN_GITHUB_IDS: '', WASP_SERVER_URL: 'http://localhost:3001/' },
  config: { frontendUrl: 'http://localhost:3000/' },
  HttpError: class HttpError extends Error {
    constructor(public statusCode: number, message: string) {
      super(message)
    }
  },
  prisma,
}))

import {
  copySharedAmbient,
  getSharedAmbient,
  setAmbientLinkSharing,
} from '../../src/ambient/management/ambient-operations'

const currentVersion = {
  id: 'version-2',
  version: 2,
  draftRevision: 4,
  document: swissPosterDocument,
  createdAt: new Date('2026-07-23T12:00:00.000Z'),
}

describe('ambient link sharing operations', () => {
  const findAmbient = prisma.ambient.findFirst
  const updateAmbient = vi.fn()
  const createAmbient = prisma.ambient.create
  const updateManyAmbients = vi.fn()
  const findVersion = prisma.ambientVersion.findUnique
  const context = {
    user: { id: 'owner-1' },
    entities: {
      Ambient: { findFirst: findAmbient, update: updateAmbient, updateMany: updateManyAmbients },
      AmbientVersion: { findUnique: findVersion },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    prisma.guestSession.findUnique.mockResolvedValue(null)
    prisma.guestSession.create.mockResolvedValue({ id: 'guest-1' })
    prisma.guestSession.updateMany.mockResolvedValue({ count: 0 })
    prisma.$transaction.mockImplementation(async (run: (store: typeof prisma) => unknown) => run(prisma))
  })

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
    findAmbient.mockResolvedValue({ id: 'ambient-1', ownerId: 'owner-2', slug: 'signal-study', currentVersion: 2 })
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
    expect(result).toMatchObject({
      id: 'ambient-1',
      slug: 'signal-study',
      isOwnedByViewer: false,
      version: { version: 2 },
    })
  })

  it('identifies the shared theme owner without exposing owner data', async () => {
    findAmbient.mockResolvedValue({ id: 'ambient-1', ownerId: 'owner-1', slug: 'signal-study', currentVersion: 2 })
    findVersion.mockResolvedValue(currentVersion)

    const result = await getSharedAmbient(
      { shareId: 'stable-share-id-123456' },
      context as never,
    )

    expect(result.isOwnedByViewer).toBe(true)
    expect(result).not.toHaveProperty('ownerId')
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

  it('copies the current shared version into an independent private draft', async () => {
    findAmbient.mockResolvedValue({ id: 'ambient-1', ownerId: 'owner-2', currentVersion: 2 })
    findVersion.mockResolvedValue(currentVersion)
    createAmbient.mockResolvedValue({ id: 'ambient-copy' })

    const result = await copySharedAmbient(
      { shareId: 'stable-share-id-123456' },
      context as never,
    )

    expect(createAmbient).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: 'owner-1',
        name: 'Swiss poster (copy)',
        currentVersion: null,
        shareId: null,
        linkSharingEnabled: false,
        draft: {
          create: expect.objectContaining({
            revision: 1,
            baseRevision: 1,
            sourceVersion: null,
            document: expect.objectContaining({ name: 'Swiss poster (copy)' }),
          }),
        },
      }),
    })
    expect(result).toEqual({ ambientId: 'ambient-copy' })
  })

  it('does not let the owner copy their own shared theme', async () => {
    findAmbient.mockResolvedValue({ id: 'ambient-1', ownerId: 'owner-1', currentVersion: 2 })

    await expect(copySharedAmbient(
      { shareId: 'stable-share-id-123456' },
      context as never,
    )).rejects.toMatchObject({ statusCode: 409 })
    expect(findVersion).toHaveBeenCalledOnce()
    expect(createAmbient).not.toHaveBeenCalled()
  })

  it('does not copy a disabled, unknown, or malformed share capability', async () => {
    findAmbient.mockResolvedValue(null)

    await expect(copySharedAmbient(
      { shareId: 'stable-share-id-123456' },
      { ...context, user: undefined } as never,
    )).rejects.toMatchObject({ statusCode: 404 })
    await expect(copySharedAmbient(
      { shareId: 'short' },
      { ...context, user: undefined } as never,
    )).rejects.toMatchObject({ statusCode: 400 })
    expect(createAmbient).not.toHaveBeenCalled()
  })

  it('mints a guest session for an anonymous copy', async () => {
    findAmbient.mockResolvedValue({ id: 'ambient-1', ownerId: 'owner-2', currentVersion: 2 })
    findVersion.mockResolvedValue(currentVersion)
    createAmbient.mockResolvedValue({ id: 'ambient-copy' })

    const result = await copySharedAmbient(
      { shareId: 'stable-share-id-123456' },
      { ...context, user: undefined } as never,
    )

    expect(result.ambientId).toBe('ambient-copy')
    expect(result.guestToken).toHaveLength(43)
    expect(createAmbient).toHaveBeenCalledWith({
      data: expect.objectContaining({ guestSessionId: 'guest-1' }),
    })
  })

  it('reuses an existing guest session for an anonymous copy', async () => {
    prisma.guestSession.findUnique.mockResolvedValue({ id: 'guest-existing', claimedAt: null })
    findAmbient.mockResolvedValue({ id: 'ambient-1', ownerId: 'owner-2', currentVersion: 2 })
    findVersion.mockResolvedValue(currentVersion)
    createAmbient.mockResolvedValue({ id: 'ambient-copy' })

    const result = await copySharedAmbient(
      { shareId: 'stable-share-id-123456', guestToken: 'guest-token-value-long-enough' },
      { ...context, user: undefined } as never,
    )

    expect(result).toEqual({ ambientId: 'ambient-copy' })
    expect(createAmbient).toHaveBeenCalledWith({
      data: expect.objectContaining({ guestSessionId: 'guest-existing' }),
    })
    expect(prisma.guestSession.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ claimedAt: null }),
      data: { claimedAt: null },
    })
    expect(prisma.guestSession.updateMany.mock.invocationCallOrder[0])
      .toBeLessThan(createAmbient.mock.invocationCallOrder[0])
    expect(prisma.guestSession.create).not.toHaveBeenCalled()
  })
})
