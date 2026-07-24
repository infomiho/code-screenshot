import {
  trackPlausibleEvent,
  type PlausibleEventOptions,
  type PlausibleProperties,
} from './plausible'
import type { PlausibleEventName } from './event-names'

export const trackProductEvent = (
  name: PlausibleEventName,
  properties?: PlausibleProperties,
  options?: PlausibleEventOptions,
) => {
  trackPlausibleEvent(name, properties, options)
}
