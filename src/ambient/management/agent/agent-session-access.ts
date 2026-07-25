import { config, env } from 'wasp/server'
import { createAccessToken, hashToken } from '../../../account/token-hash'

const agentSessionLifetimeMs = 24 * 60 * 60 * 1000

const serverUrl = () =>
  env.WASP_SERVER_URL.replace(/\/$/, '')

const capabilityUrl = (baseUrl: string, path: string, capability: string) =>
  new URL(`${path}/${encodeURIComponent(capability)}`, `${baseUrl.replace(/\/$/, '')}/`).toString()

export const hashAgentCapability = (capability: string) => hashToken(capability)

export const agentSessionUrl = (capability: string) =>
  capabilityUrl(serverUrl(), 'agent/sessions', capability)

export const agentPreviewUrl = (capability: string) =>
  capabilityUrl(config.frontendUrl, 'agent-preview', capability)

export const createAgentSessionAccess = () => {
  const capability = createAccessToken()
  return {
    capability,
    expiresAt: new Date(Date.now() + agentSessionLifetimeMs),
    url: agentSessionUrl(capability),
  }
}
