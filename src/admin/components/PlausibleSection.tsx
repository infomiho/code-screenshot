import type { PlausibleSnapshotDto } from '../contracts'
import { MetricCard } from './MetricCard'
import { TrafficChart } from './TrafficChart'

const numberFormatter = new Intl.NumberFormat()

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return minutes ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`
}

const formatTimestamp = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value))

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
          <h2 id="analytics-heading">Plausible</h2>
          <span className="admin-period">Trailing 30 days</span>
        </div>
        <div className="admin-refresh-control">
          {snapshot && <span role="status" aria-live="polite">Fetched {formatTimestamp(snapshot.fetchedAt)}</span>}
          <button className="ui-button" type="button" disabled={isRefreshing} onClick={onRefresh}>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="admin-state-copy">Loading Plausible snapshot...</p>
      ) : !snapshot ? (
        <div className="admin-inline-error">
          <p>Plausible statistics are unavailable.</p>
          <button className="ui-button" type="button" disabled={isRefreshing} onClick={onRefresh}>Try again</button>
        </div>
      ) : (
        <>
          {refreshFailed && <p className="admin-stale-warning" role="status">Refresh failed. Showing cached data.</p>}
          <div className="admin-metric-grid">
            <MetricCard label="Visitors" value={snapshot.overview.visitors} />
            <MetricCard label="Visits" value={snapshot.overview.visits} />
            <MetricCard label="Pageviews" value={snapshot.overview.pageviews} />
            <MetricCard label="Bounce rate" value={`${snapshot.overview.bounceRate}%`} />
            <MetricCard label="Visit duration" value={formatDuration(snapshot.overview.visitDuration)} />
          </div>
          <TrafficChart snapshot={snapshot} />
          <div className="admin-event-panel">
            <div className="admin-subheading"><h3>Conversions</h3></div>
            <div className="admin-event-grid">
              {snapshot.events.map((event) => (
                <div className="admin-event-row" key={event.name}>
                  <span>{event.name}</span>
                  <strong>{numberFormatter.format(event.conversions)}</strong>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
