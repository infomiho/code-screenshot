import { createHash, randomBytes } from 'node:crypto'
import { env } from 'wasp/server'

const agentSessionLifetimeMs = 24 * 60 * 60 * 1000

const serverUrl = () =>
  env.WASP_SERVER_URL.replace(/\/$/, '')

export const hashAgentCapability = (capability: string) =>
  createHash('sha256').update(capability).digest('hex')

export const agentSessionUrl = (capability: string) =>
  `${serverUrl()}/agent/sessions/${capability}`

export const agentPreviewUrl = (capability: string) =>
  `${agentSessionUrl(capability)}/preview`

export const createAgentSessionAccess = () => {
  const capability = randomBytes(32).toString('base64url')
  return {
    capability,
    expiresAt: new Date(Date.now() + agentSessionLifetimeMs),
    url: agentSessionUrl(capability),
  }
}
