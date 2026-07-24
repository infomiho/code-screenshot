const metricCount = 5
const userRowCount = 3
const eventRowCount = 8

function MetricGridSkeleton() {
  return (
    <div className="admin-metric-grid">
      {Array.from({ length: metricCount }, (_, index) => (
        <article className="admin-metric-card admin-skeleton-metric" key={index}>
          <span className="admin-skeleton admin-skeleton-label" />
          <span className="admin-skeleton admin-skeleton-value" />
        </article>
      ))}
    </div>
  )
}

export function DatabaseSectionSkeleton() {
  return (
    <div className="admin-skeleton-content" aria-hidden="true">
      <MetricGridSkeleton />
      <div className="admin-user-panel">
        <div className="admin-subheading">
          <span className="admin-skeleton admin-skeleton-heading" />
          <span className="admin-skeleton admin-skeleton-total" />
        </div>
        <div>
          <div className="admin-skeleton-table-heading">
            <span className="admin-skeleton admin-skeleton-table-label" />
            <span className="admin-skeleton admin-skeleton-table-count" />
          </div>
          {Array.from({ length: userRowCount }, (_, index) => (
            <div className="admin-skeleton-user-row" key={index}>
              <span className="admin-skeleton admin-skeleton-avatar" />
              <span className="admin-skeleton admin-skeleton-username" />
              <span className="admin-skeleton admin-skeleton-count" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function PlausibleSectionSkeleton() {
  return (
    <div className="admin-skeleton-content" aria-hidden="true">
      <MetricGridSkeleton />
      <div className="admin-chart admin-skeleton-chart">
        <div className="admin-chart-header">
          <span className="admin-skeleton admin-skeleton-heading" />
          <div className="admin-chart-legend">
            <span className="admin-skeleton admin-skeleton-legend" />
            <span className="admin-skeleton admin-skeleton-legend" />
          </div>
        </div>
        <span className="admin-skeleton admin-skeleton-chart-plot" />
      </div>
      <div className="admin-event-panel">
        <div className="admin-subheading">
          <span className="admin-skeleton admin-skeleton-heading" />
        </div>
        <div className="admin-event-grid">
          {Array.from({ length: eventRowCount }, (_, index) => (
            <div className="admin-event-row" key={index}>
              <span className="admin-skeleton admin-skeleton-event-name" />
              <span className="admin-skeleton admin-skeleton-count" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
