import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('wasp/server', () => ({
  env: new Proxy({}, { get: (_target, key) => process.env[String(key)] }),
}))

import { getPlausibleSnapshot, refreshPlausibleSnapshot, testing } from '../../src/admin/plausible-stats'

const originalApiKey = process.env.PLAUSIBLE_STATS_API_KEY
const originalSiteId = process.env.PLAUSIBLE_SITE_ID

const response = (results: Array<{ dimensions: string[]; metrics: number[] }>, meta?: unknown) => ({
  ok: true,
  json: async () => ({ results, ...(meta ? { meta } : {}) }),
})

const mockSuccessfulRequests = () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(response([{ dimensions: [], metrics: [10, 12, 25, 30, 90] }]) as Response)
    .mockResolvedValueOnce(response([
      { dimensions: ['2026-07-23'], metrics: [4, 8] },
    ], { time_labels: ['2026-07-22', '2026-07-23', '2026-07-24'] }) as Response)
    .mockResolvedValueOnce(response([
      { dimensions: ['Screenshot Copied'], metrics: [7] },
      { dimensions: ['Ambient Created'], metrics: [2] },
    ]) as Response)
}

describe('Plausible stats', () => {
  beforeEach(() => {
    process.env.PLAUSIBLE_STATS_API_KEY = 'stats-key'
    process.env.PLAUSIBLE_SITE_ID = 'codeshot.dev'
    vi.stubGlobal('fetch', vi.fn())
    testing.clearCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalApiKey === undefined) delete process.env.PLAUSIBLE_STATS_API_KEY
    else process.env.PLAUSIBLE_STATS_API_KEY = originalApiKey
    if (originalSiteId === undefined) delete process.env.PLAUSIBLE_SITE_ID
    else process.env.PLAUSIBLE_SITE_ID = originalSiteId
  })

  it('loads and maps the 30-day snapshot', async () => {
    mockSuccessfulRequests()

    const snapshot = await getPlausibleSnapshot()

    expect(fetch).toHaveBeenCalledTimes(3)
    const requests = vi.mocked(fetch).mock.calls.map(([, init]) => ({
      method: init?.method,
      authorization: new Headers(init?.headers).get('Authorization'),
      body: JSON.parse(String(init?.body)),
      hasSignal: init?.signal instanceof AbortSignal,
    }))
    expect(vi.mocked(fetch).mock.calls.every(([url]) => url === 'https://plausible.io/api/v2/query')).toBe(true)
    expect(requests).toEqual([
      {
        method: 'POST',
        authorization: 'Bearer stats-key',
        body: {
          site_id: 'codeshot.dev',
          metrics: ['visitors', 'visits', 'pageviews', 'bounce_rate', 'visit_duration'],
          date_range: '30d',
        },
        hasSignal: true,
      },
      {
        method: 'POST',
        authorization: 'Bearer stats-key',
        body: {
          site_id: 'codeshot.dev',
          metrics: ['visitors', 'pageviews'],
          date_range: '30d',
          dimensions: ['time:day'],
          include: { time_labels: true },
        },
        hasSignal: true,
      },
      {
        method: 'POST',
        authorization: 'Bearer stats-key',
        body: {
          site_id: 'codeshot.dev',
          metrics: ['events'],
          date_range: '30d',
          dimensions: ['event:goal'],
        },
        hasSignal: true,
      },
    ])
    expect(snapshot.overview).toEqual({
      visitors: 10,
      visits: 12,
      pageviews: 25,
      bounceRate: 30,
      visitDuration: 90,
    })
    expect(snapshot.daily).toEqual([
      { date: '2026-07-22', visitors: 0, pageviews: 0 },
      { date: '2026-07-23', visitors: 4, pageviews: 8 },
      { date: '2026-07-24', visitors: 0, pageviews: 0 },
    ])
    expect(snapshot.events.find((event) => event.name === 'Screenshot Copied')?.conversions).toBe(7)
    expect(snapshot.events.find((event) => event.name === 'Screenshot Downloaded')?.conversions).toBe(0)
  })

  it('reuses the snapshot until an explicit refresh', async () => {
    mockSuccessfulRequests()
    const first = await getPlausibleSnapshot()
    const cached = await getPlausibleSnapshot()

    expect(cached).toBe(first)
    expect(fetch).toHaveBeenCalledTimes(3)

    mockSuccessfulRequests()
    const refreshed = await refreshPlausibleSnapshot()
    expect(refreshed).not.toBe(first)
    expect(fetch).toHaveBeenCalledTimes(6)
  })

  it('deduplicates concurrent refreshes and retains stale data after failure', async () => {
    mockSuccessfulRequests()
    const [first, second] = await Promise.all([refreshPlausibleSnapshot(), refreshPlausibleSnapshot()])

    expect(first).toBe(second)
    expect(fetch).toHaveBeenCalledTimes(3)

    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'))
    await expect(refreshPlausibleSnapshot()).rejects.toThrow('offline')
    await expect(getPlausibleSnapshot()).resolves.toBe(first)
  })

  it('rejects malformed API responses instead of fabricating zeroes', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response([{ dimensions: [], metrics: [10] }]) as Response)
      .mockResolvedValueOnce(response([], { time_labels: [] }) as Response)
      .mockResolvedValueOnce(response([]) as Response)

    await expect(refreshPlausibleSnapshot()).rejects.toThrow()
  })
})
