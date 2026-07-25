import { trackProductEvent } from '../../product-metrics/events'
import { randomThemeName } from '../naming/random-theme-name'
import type { AmbientWorkspaceService } from './ambient-workspace-service'
import type { AmbientAccountDto } from './contracts'

type CreationSurface = 'landing' | 'workspace'

const accountDimension = (account: AmbientAccountDto) =>
  account.kind === 'signed-in' ? 'signed-in' : 'anonymous'

// Both entry points to a new theme, the landing call to action and a direct hit on /ambients/new,
// mint the name and report the same event, so the sequence lives in one place.
export const createTheme = async (
  service: AmbientWorkspaceService,
  account: AmbientAccountDto,
  surface: CreationSurface,
) => {
  const ambientId = await service.createAmbient(randomThemeName())
  if (ambientId) {
    trackProductEvent('Ambient Created', { surface, account: accountDimension(account) })
  }
  return ambientId
}
