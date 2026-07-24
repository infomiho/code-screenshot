import type { PlausibleEventName } from '../product-metrics/event-names'

export type AdminAccessDto = {
  isAdmin: boolean
}

export type AdminUserDto = {
  id: string
  githubLogin: string
  githubAvatarUrl: string | null
  ambientCount: number
}

export type AdminDashboardDto = {
  userCount: number
  ambientCount: number
  ambientCountsByStatus: {
    draft: number
    published: number
    archived: number
  }
  users: AdminUserDto[]
}

export type PlausibleSnapshotDto = {
  fetchedAt: string
  overview: {
    visitors: number
    visits: number
    pageviews: number
    bounceRate: number
    visitDuration: number
  }
  daily: Array<{
    date: string
    visitors: number
    pageviews: number
  }>
  events: Array<{
    name: PlausibleEventName
    conversions: number
  }>
}
