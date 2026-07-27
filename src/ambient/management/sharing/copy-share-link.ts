import { trackProductEvent } from '../../../product-metrics/events'
import { toastManager } from '../../../ui/toast'
import { getAmbientShareUrl } from './share-url'

export const copyAmbientShareLink = async (
  shareId: string,
  slug: string,
  surface: 'editor' | 'library',
) => {
  try {
    await navigator.clipboard.writeText(getAmbientShareUrl(shareId, slug))
    trackProductEvent('Share Link Copied', { surface })
    toastManager.add({ description: 'Sharing link copied.' })
  } catch {
    toastManager.add({ description: 'Could not copy the sharing link.', priority: 'high' })
  }
}
