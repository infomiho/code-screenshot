import { beforeEach, describe, expect, it, vi } from 'vitest'

const guestSession = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
}))

vi.mock('wasp/server', () => ({
  env: { ADMIN_GITHUB_IDS: '' },
  HttpError: class HttpError extends Error {
    constructor(public statusCode: number, message: string) {
      super(message)
    }
  },
  prisma: { guestSession },
}))

import { resolveAmbientAccess, resolveAmbientOwner } from '../../src/ambient/management/ambient-access'

const guestToken = 'guest-token-value-long-enough'

describe('resolveAmbientAccess', () => {
  beforeEach(() => vi.clearAllMocks())

  it('scopes a signed-in caller to the ambients they own', async () => {
    const access = await resolveAmbientAccess({ user: { id: 'user-1' } }, {})

    expect(access).toEqual({ kind: 'user', scope: { ownerId: 'user-1' }, actor: 'user-1' })
    expect(guestSession.findUnique).not.toHaveBeenCalled()
  })

  it('prefers the account when a stale guest token is also present', async () => {
    const access = await resolveAmbientAccess({ user: { id: 'user-1' } }, { guestToken })

    expect(access.kind).toBe('user')
    expect(guestSession.findUnique).not.toHaveBeenCalled()
  })

  it('scopes a guest to their own anonymous session', async () => {
    guestSession.findUnique.mockResolvedValue({ id: 'guest-1', claimedAt: null })

    const access = await resolveAmbientAccess({ user: null }, { guestToken })

    expect(access).toEqual({
      kind: 'guest',
      scope: { guestSessionId: 'guest-1' },
      actor: 'guest:guest-1',
    })
  })

  it('looks the token up by hash rather than storing it', async () => {
    guestSession.findUnique.mockResolvedValue({ id: 'guest-1', claimedAt: null })

    await resolveAmbientAccess({ user: null }, { guestToken })

    const [call] = guestSession.findUnique.mock.calls
    expect(call[0].where.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(call[0].where.tokenHash).not.toBe(guestToken)
  })

  it('rejects a caller with neither an account nor a token', async () => {
    await expect(resolveAmbientAccess({ user: null }, {})).rejects.toMatchObject({ statusCode: 401 })
  })

  it('rejects an unknown guest token', async () => {
    guestSession.findUnique.mockResolvedValue(null)

    await expect(resolveAmbientAccess({ user: null }, { guestToken }))
      .rejects.toMatchObject({ statusCode: 401 })
  })

  it('rejects a guest session that was already claimed', async () => {
    guestSession.findUnique.mockResolvedValue({ id: 'guest-1', claimedAt: new Date() })

    await expect(resolveAmbientAccess({ user: null }, { guestToken }))
      .rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('resolveAmbientOwner', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reuses the anonymous session the browser already holds', async () => {
    guestSession.findUnique.mockResolvedValue({ id: 'guest-1', claimedAt: null })

    const owner = await resolveAmbientOwner({ user: null }, { guestToken })

    expect(owner.scope).toEqual({ guestSessionId: 'guest-1' })
    expect(owner.mintedGuestToken).toBeUndefined()
    expect(guestSession.create).not.toHaveBeenCalled()
  })

  it('mints a server-generated token when the browser has none', async () => {
    guestSession.findUnique.mockResolvedValue(null)
    guestSession.create.mockResolvedValue({ id: 'guest-2' })

    const owner = await resolveAmbientOwner({ user: null }, {})

    expect(owner.scope).toEqual({ guestSessionId: 'guest-2' })
    expect(owner.mintedGuestToken).toHaveLength(43)
  })

  it('never adopts a token supplied by the caller', async () => {
    guestSession.findUnique.mockResolvedValue(null)
    guestSession.create.mockResolvedValue({ id: 'guest-3' })

    const owner = await resolveAmbientOwner({ user: null }, { guestToken: 'attacker-chosen-token' })

    expect(owner.mintedGuestToken).not.toBe('attacker-chosen-token')
    const [call] = guestSession.create.mock.calls
    expect(call[0].data.tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })
})
