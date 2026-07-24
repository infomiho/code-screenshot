import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { isAnalyticsRoute } from './tracked-routes'
import type { PlausibleEventName } from './event-names'

const plausibleDomain = 'codeshot.dev'

export type PlausibleProperties = Record<string, string>
export type PlausibleEventOptions = { interactive?: boolean }

type PlausibleTracker = typeof import('@plausible-analytics/tracker/plausible.js')

let trackerPromise: Promise<PlausibleTracker> | null = null

const canTrackCurrentPage = () =>
  import.meta.env.PROD
  && globalThis.location.hostname === plausibleDomain
  && isAnalyticsRoute(globalThis.location.pathname)

const loadPlausible = () => {
  if (!trackerPromise) {
    trackerPromise = import('@plausible-analytics/tracker/plausible.js').then((tracker) => {
      tracker.init({
        domain: plausibleDomain,
        autoCapturePageviews: false,
        captureOnLocalhost: false,
        logging: false,
      })
      return tracker
    }).catch((error) => {
      trackerPromise = null
      throw error
    })
  }
  return trackerPromise
}

const withPlausible = async (callback: (tracker: PlausibleTracker) => void) => {
  if (!canTrackCurrentPage()) return
  try {
    callback(await loadPlausible())
  } catch {}
}

export const trackPlausibleEvent = async (
  name: PlausibleEventName,
  properties?: PlausibleProperties,
  options?: PlausibleEventOptions,
) => {
  const url = globalThis.location.href
  await withPlausible(({ track }) => track(name, { ...options, ...(properties ? { props: properties } : {}), url }))
}

export const usePlausiblePageview = () => {
  const location = useLocation()

  useEffect(() => {
    const url = globalThis.location.href
    void withPlausible(({ track }) => track('pageview', { url }))
  }, [location.hash, location.pathname, location.search])
}

export const getAnalyticsSurface = (): 'editor' | 'workspace' | 'shared' => {
  if (globalThis.location.pathname.startsWith('/a/')) return 'shared'
  if (globalThis.location.pathname.startsWith('/ambients/')) return 'workspace'
  return 'editor'
}
