import { createHash, randomBytes } from 'node:crypto'
import { config, env } from 'wasp/server'

const agentSessionLifetimeMs = 24 * 60 * 60 * 1000

const serverUrl = () =>
  env.WASP_SERVER_URL.replace(/\/$/, '')

const capabilityUrl = (baseUrl: string, path: string, capability: string) =>
  new URL(`${path}/${encodeURIComponent(capability)}`, `${baseUrl.replace(/\/$/, '')}/`).toString()

export const hashAgentCapability = (capability: string) =>
  createHash('sha256').update(capability).digest('hex')

export const agentSessionUrl = (capability: string) =>
  capabilityUrl(serverUrl(), 'agent/sessions', capability)

export const agentPreviewUrl = (capability: string) =>
  capabilityUrl(config.frontendUrl, 'agent-preview', capability)

export const createAgentSessionAccess = () => {
  const capability = randomBytes(32).toString('base64url')
  return {
    capability,
    expiresAt: new Date(Date.now() + agentSessionLifetimeMs),
    url: agentSessionUrl(capability),
  }
}
