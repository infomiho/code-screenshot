import { z } from 'zod'
import { env } from 'wasp/server'
import { plausibleEventNames } from '../product-metrics/event-names'
import type { PlausibleSnapshotDto } from './contracts'

const plausibleQueryUrl = 'https://plausible.io/api/v2/query'
const plausibleRequestTimeoutMs = 10_000
const plausibleTimeZone = 'Europe/Zagreb'
const snapshotDayCount = 30
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const overviewResponseSchema = z.object({
  results: z.array(z.object({
    dimensions: z.tuple([]),
    metrics: z.tuple([z.number(), z.number(), z.number(), z.number(), z.number()]),
  })).length(1),
})

const dailyResponseSchema = z.object({
  results: z.array(z.object({
    dimensions: z.tuple([dateSchema]),
    metrics: z.tuple([z.number(), z.number()]),
  })),
  meta: z.object({ time_labels: z.array(dateSchema) }),
})

const eventResponseSchema = z.object({
  results: z.array(z.object({
    dimensions: z.tuple([z.string()]),
    metrics: z.tuple([z.number()]),
  })),
})

type PlausibleQuery = {
  site_id: string
  metrics: string[]
  date_range: [string, string]
  dimensions?: string[]
  include?: { time_labels: true }
}

let cachedSnapshot: PlausibleSnapshotDto | null = null
let pendingRefresh: Promise<PlausibleSnapshotDto> | null = null

const getConfiguration = () => {
  const apiKey = env.PLAUSIBLE_STATS_API_KEY?.trim()
  const siteId = env.PLAUSIBLE_SITE_ID?.trim()
  if (!apiKey || !siteId) throw new Error('Plausible stats are not configured.')
  return { apiKey, siteId }
}

const queryPlausible = async <Schema extends z.ZodType>(query: PlausibleQuery, schema: Schema) => {
  const { apiKey } = getConfiguration()
  const response = await fetch(plausibleQueryUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(query),
    signal: AbortSignal.timeout(plausibleRequestTimeoutMs),
  })
  if (!response.ok) throw new Error(`Plausible request failed with status ${response.status}.`)
  return schema.parse(await response.json()) as z.infer<Schema>
}

const getSnapshotDateRange = (now = new Date()): [string, string] => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: plausibleTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  const year = value('year')
  const month = value('month')
  const day = value('day')
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const startDate = new Date(Date.UTC(year, month - 1, day - snapshotDayCount + 1))

  return [startDate.toISOString().slice(0, 10), endDate]
}

const fetchPlausibleSnapshot = async (): Promise<PlausibleSnapshotDto> => {
  const { siteId } = getConfiguration()
  const dateRange = getSnapshotDateRange()
  const [overviewResponse, dailyResponse, eventResponse] = await Promise.all([
    queryPlausible({
      site_id: siteId,
      metrics: ['visitors', 'visits', 'pageviews', 'bounce_rate', 'visit_duration'],
      date_range: dateRange,
    }, overviewResponseSchema),
    queryPlausible({
      site_id: siteId,
      metrics: ['visitors', 'pageviews'],
      date_range: dateRange,
      dimensions: ['time:day'],
      include: { time_labels: true },
    }, dailyResponseSchema),
    queryPlausible({
      site_id: siteId,
      metrics: ['events'],
      date_range: dateRange,
      dimensions: ['event:goal'],
    }, eventResponseSchema),
  ])

  const overview = overviewResponse.results[0].metrics
  const conversions = new Map(
    eventResponse.results.map((row) => [row.dimensions[0], row.metrics[0]]),
  )
  const dailyMetrics = new Map(dailyResponse.results.map((row) => [row.dimensions[0], row.metrics]))

  return {
    fetchedAt: new Date().toISOString(),
    overview: {
      visitors: overview[0],
      visits: overview[1],
      pageviews: overview[2],
      bounceRate: overview[3],
      visitDuration: overview[4],
    },
    daily: dailyResponse.meta.time_labels.map((date) => ({
      date,
      visitors: dailyMetrics.get(date)?.[0] ?? 0,
      pageviews: dailyMetrics.get(date)?.[1] ?? 0,
    })),
    events: plausibleEventNames.map((name) => ({ name, conversions: conversions.get(name) ?? 0 })),
  }
}

export const refreshPlausibleSnapshot = () => {
  if (pendingRefresh) return pendingRefresh
  pendingRefresh = fetchPlausibleSnapshot()
    .then((snapshot) => {
      cachedSnapshot = snapshot
      return snapshot
    })
    .finally(() => {
      pendingRefresh = null
    })
  return pendingRefresh
}

export const getPlausibleSnapshot = async () => cachedSnapshot ?? refreshPlausibleSnapshot()

export const testing = {
  clearCache: () => {
    cachedSnapshot = null
    pendingRefresh = null
  },
}
