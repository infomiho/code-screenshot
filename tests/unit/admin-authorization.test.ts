import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('wasp/server', () => ({
  env: new Proxy({}, { get: (_target, key) => process.env[String(key)] }),
  HttpError: class HttpError extends Error {
    constructor(public statusCode: number, message: string) {
      super(message)
    }
  },
}))

const originalAdminGitHubIds = process.env.ADMIN_GITHUB_IDS

const loadAuthorization = async (value?: string) => {
  vi.resetModules()
  if (value === undefined) {
    delete process.env.ADMIN_GITHUB_IDS
  } else {
    process.env.ADMIN_GITHUB_IDS = value
  }
  return import('../../src/admin/admin-authorization')
}

afterEach(() => {
  if (originalAdminGitHubIds === undefined) {
    delete process.env.ADMIN_GITHUB_IDS
  } else {
    process.env.ADMIN_GITHUB_IDS = originalAdminGitHubIds
  }
})

describe('admin authorization', () => {
  it('grants access by immutable GitHub ID', async () => {
    const { isAdmin } = await loadAuthorization('12345,67890')

    expect(isAdmin({ identities: { github: { id: '67890' } } })).toBe(true)
    expect(isAdmin({ identities: { github: { id: '54321' } } })).toBe(false)
  })

  it('grants no access when the allowlist is missing', async () => {
    const { isAdmin } = await loadAuthorization()

    expect(isAdmin({ identities: { github: { id: '12345' } } })).toBe(false)
  })

  it('rejects malformed allowlists', async () => {
    await expect(loadAuthorization('12345,octocat')).rejects.toThrow('ADMIN_GITHUB_IDS')
    await expect(loadAuthorization('12345,')).rejects.toThrow('ADMIN_GITHUB_IDS')
  })

  it('distinguishes unauthenticated and unauthorized callers', async () => {
    const { requireAdmin } = await loadAuthorization('12345')

    expect(() => requireAdmin(undefined)).toThrow(expect.objectContaining({ statusCode: 401 }))
    expect(() => requireAdmin({ identities: { github: { id: '54321' } } })).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    )
    expect(() => requireAdmin({ identities: { github: { id: '12345' } } })).not.toThrow()
  })
})
