import { afterEach, describe, expect, it, vi } from 'vitest'

describe('guest session storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('keeps the token in memory when local storage is unavailable', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('Storage blocked') },
      setItem: () => { throw new Error('Storage blocked') },
      removeItem: () => { throw new Error('Storage blocked') },
    })
    const { clearGuestToken, readGuestToken, storeGuestToken } = await import('../../src/account/guest-session')

    storeGuestToken('memory-guest-token')
    expect(readGuestToken()).toBe('memory-guest-token')
    clearGuestToken()
    expect(readGuestToken()).toBeNull()
  })
})
