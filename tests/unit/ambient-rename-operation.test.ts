import { beforeEach, describe, expect, it, vi } from 'vitest'
import { swissPosterDocument } from '../../src/ambient/rendering/themes/swiss-poster'

const transaction = vi.hoisted(() => ({
  ambient: { findFirst: vi.fn(), update: vi.fn() },
  ambientDraft: { update: vi.fn() },
}))
const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  guestSession: { findUnique: vi.fn() },
}))

vi.mock('wasp/server', () => ({
  env: { ADMIN_GITHUB_IDS: '' },
  HttpError: class HttpError extends Error {
    constructor(public statusCode: number, message: string) {
      super(message)
    }
  },
  prisma,
}))

import { renameAmbient } from '../../src/ambient/management/ambient-operations'

const context = { user: { id: 'user-1' } }
const args = { ambientId: 'ambient-1', name: 'quiet thistle' }

describe('renameAmbient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.$transaction.mockImplementation(async (run: (tx: typeof transaction) => unknown) =>
      run(transaction))
    transaction.ambient.findFirst.mockResolvedValue({
      id: 'ambient-1',
      draft: { document: swissPosterDocument },
    })
    transaction.ambientDraft.update.mockResolvedValue({ revision: 6 })
  })

  it('advances both revision counters so a rename is not mistaken for agent work', async () => {
    await renameAmbient(args, context as never)

    const [call] = transaction.ambientDraft.update.mock.calls
    expect(call[0].data.revision).toEqual({ increment: 1 })
    expect(call[0].data.baseRevision).toEqual({ increment: 1 })
  })

  it('writes the name into the draft document, not just the ambient row', async () => {
    await renameAmbient(args, context as never)

    const [draftCall] = transaction.ambientDraft.update.mock.calls
    expect(draftCall[0].data.document.name).toBe('quiet thistle')
    expect(transaction.ambient.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { name: 'quiet thistle' },
    }))
  })

  it('returns the advanced revision so an in-flight agent write conflicts and refetches', async () => {
    const result = await renameAmbient(args, context as never)

    expect(result).toEqual({ name: 'quiet thistle', revision: 6 })
  })

  it('scopes the lookup to the caller', async () => {
    await renameAmbient(args, context as never)

    expect(transaction.ambient.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ambient-1', ownerId: 'user-1' },
    }))
  })

  it('lets a guest rename their own theme', async () => {
    prisma.guestSession.findUnique.mockResolvedValue({ id: 'guest-1', claimedAt: null })

    await renameAmbient(
      { ...args, guestToken: 'guest-token-value-long-enough' },
      { user: null } as never,
    )

    expect(transaction.ambient.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ambient-1', guestSessionId: 'guest-1' },
    }))
  })

  it('refuses a theme with no working draft', async () => {
    transaction.ambient.findFirst.mockResolvedValue({ id: 'ambient-1', draft: null })

    await expect(renameAmbient(args, context as never)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('refuses a theme the caller cannot reach', async () => {
    transaction.ambient.findFirst.mockResolvedValue(null)

    await expect(renameAmbient(args, context as never)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('rejects a blank name before touching the database', async () => {
    await expect(renameAmbient({ ...args, name: '   ' }, context as never))
      .rejects.toMatchObject({ statusCode: 400 })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
