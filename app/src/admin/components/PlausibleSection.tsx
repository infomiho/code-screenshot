import type { CSSProperties } from 'react'
import type { PlausibleEventName } from '../../product-metrics/event-names'
import type { PlausibleSnapshotDto } from '../contracts'
import { PlausibleSectionSkeleton } from './AdminSectionSkeletons'
import { MetricCard } from './MetricCard'
import { TrafficChart } from './TrafficChart'

const numberFormatter = new Intl.NumberFormat()
const periodDateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

const actionGroups: Array<{ id: string; label: string; events: PlausibleEventName[] }> = [
  { id: 'produce', label: 'Produce', events: ['Screenshot Copied', 'Screenshot Downloaded', 'Screenshot Rendered'] },
  { id: 'save', label: 'Save and refine', events: ['Ambient Created', 'Ambient Version Saved'] },
  { id: 'share', label: 'Share', events: ['Ambient Sharing Enabled', 'Share Link Copied', 'Shared Ambient Viewed'] },
  { id: 'assist', label: 'Assist', events: ['Agent Prompt Copied'] },
]

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return minutes ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`
}

const formatTimestamp = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value))

const formatPeriod = (snapshot: PlausibleSnapshotDto) => {
  const firstDay = snapshot.daily[0]?.date
  const lastDay = snapshot.daily.at(-1)?.date
  if (!firstDay || !lastDay) return 'Trailing 30 days'
  const format = (date: string) => periodDateFormatter.format(new Date(`${date}T00:00:00`))
  return `${format(firstDay)}–${format(lastDay)}`
}

const eventCount = (snapshot: PlausibleSnapshotDto, names: PlausibleEventName[]) =>
  snapshot.events
    .filter((event) => names.includes(event.name))
    .reduce((total, event) => total + event.conversions, 0)

const formatCount = (value: number, singular: string, plural = `${singular}s`) =>
  `${numberFormatter.format(value)} ${value === 1 ? singular : plural}`

const formatPulseSummary = (snapshot: PlausibleSnapshotDto) => {
  const visitors = formatCount(snapshot.overview.visitors, 'visitor')
  const outputActions = formatCount(eventCount(snapshot, actionGroups[0].events), 'screenshot output action')
  const ambientActions = formatCount(eventCount(snapshot, actionGroups[1].events), 'theme action')
  const sharingEvents = formatCount(eventCount(snapshot, actionGroups[2].events), 'sharing event')
  return `${visitors} reached codeshot.dev; ${outputActions}, ${ambientActions}, and ${sharingEvents} were recorded.`
}

function TrafficTrend({ snapshot }: { snapshot: PlausibleSnapshotDto }) {
  const activeDays = snapshot.daily.filter((day) => day.visitors > 0)
  const shouldShowChart = activeDays.length >= 7 || snapshot.overview.visitors >= 30

  if (activeDays.length === 0) {
    return <div className="admin-traffic-empty">No visitors recorded from {formatPeriod(snapshot)}.</div>
  }

  if (shouldShowChart) return <TrafficChart snapshot={snapshot} />

  return (
    <div className="admin-sparse-traffic">
      <div className="admin-subheading"><h3>Active days</h3><span>Visitors</span></div>
      {activeDays.map((day) => (
        <div className="admin-sparse-traffic-row" key={day.date}>
          <span>{periodDateFormatter.format(new Date(`${day.date}T00:00:00`))}</span>
          <strong>{numberFormatter.format(day.visitors)}</strong>
        </div>
      ))}
    </div>
  )
}

function ProductActions({ snapshot }: { snapshot: PlausibleSnapshotDto }) {
  const maximum = Math.max(0, ...snapshot.events.map((event) => event.conversions))

  return (
    <div className="admin-actions-panel">
      <div className="admin-subheading">
        <h3>Product actions</h3>
        <span>Occurrences; actions are independent and may repeat</span>
      </div>
      <div className="admin-action-groups">
        {actionGroups.map((group) => (
          <section className="admin-action-group" aria-labelledby={`action-${group.id}`} key={group.id}>
            <h4 id={`action-${group.id}`}>{group.label}</h4>
            {group.events.map((name) => {
              const conversions = snapshot.events.find((event) => event.name === name)?.conversions ?? 0
              const width = maximum === 0 ? 0 : conversions / maximum * 100
              return (
                <div className="admin-action-row" data-empty={conversions === 0 || undefined} key={name}>
                  <span>{name}</span>
                  <div className="admin-action-track" aria-hidden="true">
                    <i style={{ '--action-width': `${width}%` } as CSSProperties} />
                  </div>
                  <strong>{numberFormatter.format(conversions)}</strong>
                </div>
              )
            })}
          </section>
        ))}
      </div>
    </div>
  )
}

type PlausibleSectionProps = {
  snapshot?: PlausibleSnapshotDto
  isLoading: boolean
  isRefreshing: boolean
  refreshFailed: boolean
  onRefresh: () => void
}

export function PlausibleSection({
  snapshot,
  isLoading,
  isRefreshing,
  refreshFailed,
  onRefresh,
}: PlausibleSectionProps) {
  return (
    <section className="admin-section" aria-labelledby="analytics-heading" aria-busy={isRefreshing}>
      <div className="admin-section-heading">
        <div className="admin-section-title">
          <h2 id="analytics-heading">Product pulse</h2>
          {snapshot && <span className="admin-period">{formatPeriod(snapshot)}</span>}
        </div>
        <div className="admin-refresh-control">
          {snapshot && <span role="status" aria-live="polite">Fetched {formatTimestamp(snapshot.fetchedAt)}</span>}
          <button className="ui-button" type="button" disabled={isRefreshing} onClick={onRefresh}>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <>
          <p className="sr-only" role="status">Loading Plausible statistics</p>
          <PlausibleSectionSkeleton />
        </>
      ) : !snapshot ? (
        <div className="admin-inline-error">
          <p>Plausible statistics are unavailable.</p>
          <button className="ui-button" type="button" disabled={isRefreshing} onClick={onRefresh}>Try again</button>
        </div>
      ) : (
        <>
          {refreshFailed && <p className="admin-stale-warning" role="status">Refresh failed. Showing cached data.</p>}
          <p className="admin-pulse-summary">{formatPulseSummary(snapshot)}</p>
          <div className="admin-pulse-grid">
            <MetricCard label="Visitors" value={snapshot.overview.visitors} />
            <MetricCard label="Screenshot output actions" value={eventCount(snapshot, actionGroups[0].events)} />
            <MetricCard label="Theme activity" value={eventCount(snapshot, actionGroups[1].events)} />
          </div>
          <div className="admin-traffic-layout">
            <TrafficTrend snapshot={snapshot} />
            <div className="admin-traffic-details">
              <div className="admin-subheading"><h3>Traffic details</h3><span>Source: Plausible</span></div>
              <dl>
                <div><dt>Visits</dt><dd>{numberFormatter.format(snapshot.overview.visits)}</dd></div>
                <div><dt>Pageviews</dt><dd>{numberFormatter.format(snapshot.overview.pageviews)}</dd></div>
                <div><dt>Bounce rate</dt><dd>{snapshot.overview.bounceRate}%</dd></div>
                <div><dt>Avg. visit duration</dt><dd>{formatDuration(snapshot.overview.visitDuration)}</dd></div>
              </dl>
            </div>
          </div>
          <ProductActions snapshot={snapshot} />
        </>
      )}
    </section>
  )
}
