import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('wasp/server', () => ({
  env: new Proxy({}, { get: (_target, key) => process.env[String(key)] }),
}))

import { trackScreenshotRendered } from '../../src/product-metrics/product-metrics-api'

const originalSiteId = process.env.PLAUSIBLE_SITE_ID

const request = {
  get: (name: string) => ({
    'cf-connecting-ip': '203.0.113.8',
    'user-agent': 'codeshot.dev/0.3.0',
  })[name],
  ip: '10.0.0.1',
}

describe('server product metrics', () => {
  beforeEach(() => {
    process.env.PLAUSIBLE_SITE_ID = 'codeshot.dev'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 202 })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalSiteId === undefined) delete process.env.PLAUSIBLE_SITE_ID
    else process.env.PLAUSIBLE_SITE_ID = originalSiteId
  })

  it('sends a successful render with source and client identity', async () => {
    await trackScreenshotRendered(request, 'cli')

    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://plausible.io/api/event')
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
    expect(new Headers(init?.headers).get('User-Agent')).toBe('codeshot.dev/0.3.0')
    expect(new Headers(init?.headers).get('X-Forwarded-For')).toBe('203.0.113.8')
    expect(JSON.parse(String(init?.body))).toEqual({
      domain: 'codeshot.dev',
      name: 'Screenshot Rendered',
      url: 'https://api.codeshot.dev/v1/screenshots',
      props: { source: 'cli' },
    })
  })

  it('does nothing when Plausible is not configured', async () => {
    delete process.env.PLAUSIBLE_SITE_ID

    await trackScreenshotRendered(request, 'api')

    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not expose Plausible failures to API callers', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'))

    await expect(trackScreenshotRendered(request, 'api')).resolves.toBeUndefined()
  })
})
