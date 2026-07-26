import { trackProductEvent } from '../../product-metrics/events'
import type { AmbientWorkspaceService } from './ambient-workspace-service'
import type { AmbientAccountDto } from './contracts'

type CreationSurface = 'landing' | 'workspace'

const accountDimension = (account: AmbientAccountDto) =>
  account.kind === 'signed-in' ? 'signed-in' : 'anonymous'

export const createTheme = async (
  service: AmbientWorkspaceService,
  account: AmbientAccountDto,
  surface: CreationSurface,
) => {
  const ambientId = await service.createAmbient('Custom Theme')
  if (!ambientId) return null
  trackProductEvent('Ambient Created', { surface, account: accountDimension(account) })
  // The workspace opens on the prompt, so the session it needs is created before anyone gets there.
  await service.createAgentAccess(ambientId)
  return ambientId
}
