import { defineEnvValidationSchema } from 'wasp/env'
import { z } from 'zod'

export const serverEnvSchema = defineEnvValidationSchema(z.object({
  ADMIN_GITHUB_IDS: z.string().trim()
    .regex(/^$|^[1-9]\d*(,[1-9]\d*)*$/, 'Must be comma-separated numeric GitHub IDs.')
    .default(''),
  PLAUSIBLE_SITE_ID: z.string().trim().min(1).optional(),
  PLAUSIBLE_STATS_API_KEY: z.string().trim().min(1).optional(),
}).refine(
  ({ PLAUSIBLE_SITE_ID, PLAUSIBLE_STATS_API_KEY }) => Boolean(PLAUSIBLE_SITE_ID) === Boolean(PLAUSIBLE_STATS_API_KEY),
  { message: 'PLAUSIBLE_SITE_ID and PLAUSIBLE_STATS_API_KEY must be configured together.' },
))
