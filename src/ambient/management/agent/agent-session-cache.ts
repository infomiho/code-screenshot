import type { AgentSessionDto } from '../contracts'

const sessionStoragePrefix = 'codeshot.agent-session.'
const sessionKey = (ambientId: string) => `${sessionStoragePrefix}${ambientId}`

export const readAgentSession = (ambientId: string) => {
  try {
    const value = globalThis.sessionStorage?.getItem(sessionKey(ambientId))
    if (!value) return null
    const session = JSON.parse(value) as AgentSessionDto
    if (new Date(session.expiresAt) <= new Date()) return null
    return session
  } catch {
    return null
  }
}

export const cacheAgentSession = (session: AgentSessionDto | null, ambientId: string) => {
  try {
    if (!globalThis.sessionStorage) return false
    if (session) globalThis.sessionStorage.setItem(sessionKey(ambientId), JSON.stringify(session))
    else globalThis.sessionStorage.removeItem(sessionKey(ambientId))
    return true
  } catch {
    return false
  }
}

export const clearAgentSessions = () => {
  try {
    if (!globalThis.sessionStorage) return
    const keys = Array.from(
      { length: globalThis.sessionStorage.length },
      (_, index) => globalThis.sessionStorage.key(index),
    )
    keys.forEach((key) => {
      if (key?.startsWith(sessionStoragePrefix)) globalThis.sessionStorage.removeItem(key)
    })
  } catch {
    // Server revocation remains authoritative when session storage is unavailable.
  }
}
