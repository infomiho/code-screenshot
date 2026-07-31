import { beforeEach, describe, expect, it, vi } from 'vitest'

const transaction = vi.hoisted(() => ({
  guestSession: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  ambient: { findMany: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
}))
const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  guestSession: transaction.guestSession,
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

import { claimGuestAmbients } from '../../src/ambient/management/ambient-operations'

const guestToken = 'guest-token-value-long-enough'
const context = { user: { id: 'user-1' } }

const withAgentWork = (id: string, slug: string) => ({
  id,
  name: 'quiet thistle',
  slug,
  draft: { revision: 5 },
  agentSessions: [{ lastUsedAt: new Date('2026-07-25T12:00:00.000Z') }],
})

const untouched = (id: string, slug: string) => ({
  id,
  name: 'amber drift',
  slug,
  draft: { revision: 0 },
  agentSessions: [{ lastUsedAt: null }],
})

describe('claimGuestAmbients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.$transaction.mockImplementation(async (run: (tx: typeof transaction) => unknown) =>
      run(transaction))
    transaction.ambient.findMany.mockResolvedValue([])
    transaction.guestSession.updateMany.mockResolvedValue({ count: 1 })
  })

  it('claims every theme that holds agent work', async () => {
    transaction.guestSession.findUnique.mockResolvedValue({
      id: 'guest-1',
      claimedAt: null,
      ambients: [withAgentWork('ambient-1', 'a-1'), withAgentWork('ambient-2', 'a-2')],
    })

    const result = await claimGuestAmbients({ guestToken }, context as never)

    expect(result.claimedAmbientIds).toEqual(['ambient-1', 'ambient-2'])
    expect(transaction.ambient.update).toHaveBeenCalledTimes(2)
    expect(transaction.guestSession.updateMany.mock.invocationCallOrder[0])
      .toBeLessThan(transaction.guestSession.findUnique.mock.invocationCallOrder[0])
  })

  it('hands ownership over in a single update so the owner/guest constraint always holds', async () => {
    transaction.guestSession.findUnique.mockResolvedValue({
      id: 'guest-1',
      claimedAt: null,
      ambients: [withAgentWork('ambient-1', 'a-1')],
    })

    await claimGuestAmbients({ guestToken }, context as never)

    const [call] = transaction.ambient.update.mock.calls
    expect(call[0].data).toMatchObject({ ownerId: 'user-1', guestSessionId: null })
  })

  it('drops themes with no agent session and no accepted changes', async () => {
    transaction.guestSession.findUnique.mockResolvedValue({
      id: 'guest-1',
      claimedAt: null,
      ambients: [withAgentWork('ambient-1', 'a-1'), untouched('ambient-2', 'a-2')],
    })

    const result = await claimGuestAmbients({ guestToken }, context as never)

    expect(result.claimedAmbientIds).toEqual(['ambient-1'])
    expect(result.discardedAmbientIds).toEqual(['ambient-2'])
    expect(transaction.ambient.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['ambient-2'] } },
    })
  })

  it('keeps a theme the visitor renamed before connecting an agent', async () => {
    transaction.guestSession.findUnique.mockResolvedValue({
      id: 'guest-1',
      claimedAt: null,
      ambients: [{
        id: 'ambient-1',
        name: 'quiet thistle',
        slug: 'a-1',
            draft: { revision: 1 },
        agentSessions: [{ lastUsedAt: null }],
      }],
    })

    const result = await claimGuestAmbients({ guestToken }, context as never)

    expect(result.claimedAmbientIds).toEqual(['ambient-1'])
    expect(result.discardedAmbientIds).toEqual([])
  })

  it('keeps a copied baseline draft during sign in', async () => {
    transaction.guestSession.findUnique.mockResolvedValue({
      id: 'guest-1',
      claimedAt: null,
      ambients: [{
        id: 'ambient-copy',
        name: 'quiet thistle (copy)',
        slug: 'quiet-thistle-copy',
        draft: { revision: 1 },
        agentSessions: [],
      }],
    })

    const result = await claimGuestAmbients({ guestToken }, context as never)

    expect(result.claimedAmbientIds).toEqual(['ambient-copy'])
    expect(result.discardedAmbientIds).toEqual([])
  })

  it('keeps a theme the agent fetched but has not written to yet', async () => {
    transaction.guestSession.findUnique.mockResolvedValue({
      id: 'guest-1',
      claimedAt: null,
      ambients: [{
        id: 'ambient-1',
        name: 'quiet thistle',
        slug: 'a-1',
        draft: { revision: 0 },
        agentSessions: [{ lastUsedAt: new Date('2026-07-25T12:00:00.000Z') }],
      }],
    })

    const result = await claimGuestAmbients({ guestToken }, context as never)

    expect(result.claimedAmbientIds).toEqual(['ambient-1'])
    expect(result.discardedAmbientIds).toEqual([])
  })

  it('gives a colliding slug a fresh suffix instead of failing the claim', async () => {
    transaction.ambient.findMany.mockResolvedValue([{ slug: 'taken-slug' }])
    transaction.guestSession.findUnique.mockResolvedValue({
      id: 'guest-1',
      claimedAt: null,
      ambients: [withAgentWork('ambient-1', 'taken-slug')],
    })

    await claimGuestAmbients({ guestToken }, context as never)

    const [call] = transaction.ambient.update.mock.calls
    expect(call[0].data.slug).not.toBe('taken-slug')
    expect(call[0].data.slug).toMatch(/^quiet-thistle-[0-9a-f]{6}$/)
  })

  it('marks the session claimed so its token stops working', async () => {
    transaction.guestSession.findUnique.mockResolvedValue({
      id: 'guest-1',
      claimedAt: null,
      ambients: [withAgentWork('ambient-1', 'a-1')],
    })

    await claimGuestAmbients({ guestToken }, context as never)

    expect(transaction.guestSession.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'guest-1' },
      data: expect.objectContaining({ claimedBy: 'user-1' }),
    }))
  })

  it('is a no-op for a session that was already claimed', async () => {
    transaction.guestSession.findUnique.mockResolvedValue({
      id: 'guest-1',
      claimedAt: new Date(),
      ambients: [withAgentWork('ambient-1', 'a-1')],
    })

    const result = await claimGuestAmbients({ guestToken }, context as never)

    expect(result).toEqual({ claimedAmbientIds: [], discardedAmbientIds: [] })
    expect(transaction.ambient.update).not.toHaveBeenCalled()
  })

  it('retries once when two tabs claim at the same time', async () => {
    transaction.guestSession.findUnique.mockResolvedValue({
      id: 'guest-1',
      claimedAt: null,
      ambients: [withAgentWork('ambient-1', 'a-1')],
    })
    prisma.$transaction
      .mockRejectedValueOnce(Object.assign(new Error('write conflict'), { code: 'P2034' }))
      .mockImplementationOnce(async (run: (tx: typeof transaction) => unknown) => run(transaction))

    const result = await claimGuestAmbients({ guestToken }, context as never)

    expect(result.claimedAmbientIds).toEqual(['ambient-1'])
    expect(prisma.$transaction).toHaveBeenCalledTimes(2)
  })

  it('requires an account', async () => {
    await expect(claimGuestAmbients({ guestToken }, { user: undefined } as never))
      .rejects.toMatchObject({ statusCode: 401 })
  })
})
