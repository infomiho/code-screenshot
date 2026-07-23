import { defineUserSignupFields } from 'wasp/server/auth'
import { z } from 'zod'

const githubLoginSchema = z.object({
  profile: z.object({
    login: z.string().min(1),
  }),
})

const githubAvatarSchema = z.object({
  profile: z.object({
    avatar_url: z.string().url().nullish(),
  }),
})

const parseGitHubData = <T>(schema: z.ZodType<T>, data: unknown) => {
  const result = schema.safeParse(data)
  if (!result.success) throw new Error('GitHub returned an invalid profile.')
  return result.data
}

export const userSignupFields = defineUserSignupFields({
  githubLogin: (data: unknown) => parseGitHubData(githubLoginSchema, data).profile.login,
  githubAvatarUrl: (data: unknown) =>
    parseGitHubData(githubAvatarSchema, data).profile.avatar_url ?? null,
})
