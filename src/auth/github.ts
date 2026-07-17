import { defineUserSignupFields } from 'wasp/server/auth'

type GitHubProfile = {
  login?: unknown
  avatar_url?: unknown
}

const getProfile = (data: unknown) => (data as { profile?: GitHubProfile }).profile

export const userSignupFields = defineUserSignupFields({
  githubLogin: (data: unknown) => {
    const login = getProfile(data)?.login
    if (typeof login !== 'string' || login.length === 0) {
      throw new Error('GitHub did not provide a login.')
    }
    return login
  },
  githubAvatarUrl: (data: unknown) => {
    const avatarUrl = getProfile(data)?.avatar_url
    return typeof avatarUrl === 'string' ? avatarUrl : null
  },
})
