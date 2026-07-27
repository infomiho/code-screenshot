// localStorage rather than sessionStorage, so a refresh or a new tab keeps the work.
const guestSessionKey = 'codeshot.guest-session'
const claimIntentKey = 'codeshot.claim-intent'
const claimIntentLifetime = 15 * 60 * 1000
let inMemoryGuestToken: string | null = null

export type ClaimIntent = {
  guestToken: string
  ambientId: string
  saveOnReturn: boolean
  createdAt: number
}

export const readGuestToken = (): string | null => {
  try {
    return globalThis.localStorage?.getItem(guestSessionKey) ?? inMemoryGuestToken
  } catch {
    return inMemoryGuestToken
  }
}

export const storeGuestToken = (token: string) => {
  inMemoryGuestToken = token
  try {
    globalThis.localStorage?.setItem(guestSessionKey, token)
  } catch {
    // Without local persistence the theme stays usable until the tab closes.
  }
}

export const clearGuestToken = () => {
  inMemoryGuestToken = null
  try {
    globalThis.localStorage?.removeItem(guestSessionKey)
  } catch {
    // Nothing to clean up when local storage is unavailable.
  }
}

export const rememberClaimIntent = (intent: Omit<ClaimIntent, 'createdAt'>) => {
  try {
    globalThis.localStorage?.setItem(
      claimIntentKey,
      JSON.stringify({ ...intent, createdAt: Date.now() } satisfies ClaimIntent),
    )
  } catch {
    // Sign in still works; the browser just lands on the theme without saving automatically.
  }
}

// Reading consumes the intent, so an interrupted sign in cannot replay it later.
export const takeClaimIntent = (): ClaimIntent | null => {
  try {
    const value = globalThis.localStorage?.getItem(claimIntentKey)
    if (!value) return null
    globalThis.localStorage.removeItem(claimIntentKey)
    const intent = JSON.parse(value) as ClaimIntent
    return Date.now() - intent.createdAt > claimIntentLifetime ? null : intent
  } catch {
    return null
  }
}
