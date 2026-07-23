import { beforeEach, describe, expect, it } from 'vitest'
import {
  cacheAgentSession,
  clearAgentSessions,
  readAgentSession,
} from '../../src/ambient-workspace/agent-session-cache'

const createStorage = (): Storage => {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: createStorage(),
  })
})

describe('agent session cache', () => {
  it('keeps an active capability scoped to its ambient', () => {
    const session = {
      ambientId: 'ambient-1',
      generation: 2,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      url: 'https://codeshot.dev/agent/sessions/secret',
    }

    expect(cacheAgentSession(session, session.ambientId)).toBe(true)
    expect(readAgentSession('ambient-1')).toEqual(session)
    expect(readAgentSession('ambient-2')).toBeNull()
  })

  it('does not restore expired or malformed capabilities', () => {
    sessionStorage.setItem('codeshot.agent-session.expired', JSON.stringify({
      ambientId: 'expired',
      generation: 1,
      expiresAt: new Date(Date.now() - 1).toISOString(),
      url: 'https://codeshot.dev/agent/sessions/expired',
    }))
    sessionStorage.setItem('codeshot.agent-session.malformed', '{')

    expect(readAgentSession('expired')).toBeNull()
    expect(readAgentSession('malformed')).toBeNull()
  })

  it('clears capabilities without removing unrelated session data', () => {
    sessionStorage.setItem('codeshot.agent-session.ambient-1', '{}')
    sessionStorage.setItem('codeshot.post-auth-route', '/ambients/new')

    clearAgentSessions()

    expect(sessionStorage.getItem('codeshot.agent-session.ambient-1')).toBeNull()
    expect(sessionStorage.getItem('codeshot.post-auth-route')).toBe('/ambients/new')
  })
})
