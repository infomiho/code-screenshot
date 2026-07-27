import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const guestSession = vi.hoisted(() => ({
  token: null as string | null,
  read: vi.fn(),
  store: vi.fn(),
}))

vi.mock('../../src/account/guest-session', () => ({
  readGuestToken: guestSession.read,
  storeGuestToken: guestSession.store,
}))

describe('createWithGuestSession', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    guestSession.token = null
    guestSession.read.mockImplementation(() => guestSession.token)
    guestSession.store.mockImplementation((token: string) => {
      guestSession.token = token
    })
    let queue: Promise<unknown> = Promise.resolve()
    vi.stubGlobal('navigator', {
      locks: {
        request: (_name: string, create: () => Promise<unknown>) => {
          const result = queue.then(create, create)
          queue = result.then(() => undefined, () => undefined)
          return result
        },
      },
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('serializes concurrent creations and reuses the first minted guest token', async () => {
    const { createWithGuestSession } = await import('../../src/ambient/management/guest-ambient-creation')
    const receivedTokens: Array<string | null> = []
    const create = async (guestToken: string | null) => {
      receivedTokens.push(guestToken)
      return guestToken
        ? { ambientId: 'ambient-2' }
        : { ambientId: 'ambient-1', guestToken: 'minted-guest-token-value-long-enough' }
    }

    const [first, second] = await Promise.all([
      createWithGuestSession(create),
      createWithGuestSession(create),
    ])

    expect(receivedTokens).toEqual([null, 'minted-guest-token-value-long-enough'])
    expect(first.guestToken).toBe('minted-guest-token-value-long-enough')
    expect(second.guestToken).toBe('minted-guest-token-value-long-enough')
    expect(guestSession.store).toHaveBeenCalledTimes(1)
  })

})
