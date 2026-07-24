import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tracker = vi.hoisted(() => ({ init: vi.fn(), track: vi.fn() }))

vi.mock('@plausible-analytics/tracker/plausible.js', () => tracker)

describe('Plausible client', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv('PROD', true)
    vi.stubGlobal('location', { hostname: 'codeshot.dev', pathname: '/', href: 'https://codeshot.dev/' })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('initializes once and sends typed properties in production', async () => {
    const { trackPlausibleEvent } = await import('../../src/product-metrics/metrics-client')

    await trackPlausibleEvent('Screenshot Copied', { surface: 'editor' })
    await trackPlausibleEvent('Screenshot Downloaded', { surface: 'editor' })

    expect(tracker.init).toHaveBeenCalledOnce()
    expect(tracker.init).toHaveBeenCalledWith({
      domain: 'codeshot.dev',
      endpoint: 'https://api.codeshot.dev/pulse',
      autoCapturePageviews: false,
      logging: false,
    })
    expect(tracker.track).toHaveBeenNthCalledWith(1, 'Screenshot Copied', {
      props: { surface: 'editor' },
      url: 'https://codeshot.dev/',
    })
    expect(tracker.track).toHaveBeenNthCalledWith(2, 'Screenshot Downloaded', {
      props: { surface: 'editor' },
      url: 'https://codeshot.dev/',
    })
  })

  it('does not initialize on excluded routes', async () => {
    vi.stubGlobal('location', { hostname: 'codeshot.dev', pathname: '/admin', href: 'https://codeshot.dev/admin' })
    const { trackPlausibleEvent } = await import('../../src/product-metrics/metrics-client')

    await trackPlausibleEvent('Screenshot Copied')

    expect(tracker.init).not.toHaveBeenCalled()
    expect(tracker.track).not.toHaveBeenCalled()
  })

  it('does not initialize outside production', async () => {
    vi.stubEnv('PROD', false)
    const { trackPlausibleEvent } = await import('../../src/product-metrics/metrics-client')

    await trackPlausibleEvent('Screenshot Copied')

    expect(tracker.init).not.toHaveBeenCalled()
  })

  it('supports non-interactive events', async () => {
    const { trackPlausibleEvent } = await import('../../src/product-metrics/metrics-client')

    await trackPlausibleEvent('Shared Ambient Viewed', { surface: 'shared' }, { interactive: false })

    expect(tracker.track).toHaveBeenCalledWith('Shared Ambient Viewed', {
      interactive: false,
      props: { surface: 'shared' },
      url: 'https://codeshot.dev/',
    })
  })
})
