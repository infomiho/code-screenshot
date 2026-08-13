import type { AuthUser } from 'wasp/auth'
import { env, HttpError } from 'wasp/server'

const parseAdminGitHubIds = (value: string | undefined) => {
  if (!value?.trim()) return new Set<string>()

  const ids = value.split(',').map((id) => id.trim())
  if (ids.some((id) => !/^[1-9]\d*$/.test(id))) {
    throw new Error('ADMIN_GITHUB_IDS must be a comma-separated list of numeric GitHub IDs.')
  }
  return new Set(ids)
}

const adminGitHubIds = parseAdminGitHubIds(env.ADMIN_GITHUB_IDS)

export const isAdmin = (user: AuthUser | undefined) => {
  const githubId = user?.identities.github?.id
  return githubId ? adminGitHubIds.has(githubId) : false
}

export const requireAdmin = (user: AuthUser | undefined) => {
  if (!user) throw new HttpError(401, 'Authentication required.')
  if (!isAdmin(user)) throw new HttpError(403, 'Administrator access required.')
}

export const testing = { parseAdminGitHubIds }
