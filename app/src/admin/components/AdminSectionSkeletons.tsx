import { AdminPageFrame } from './AdminPageFrame'

const userRowCount = 3
const actionGroupSizes = [3, 2, 3, 1]

export function AdminPageSkeleton() {
  return (
    <>
      <p className="sr-only" role="status">Loading admin dashboard</p>
      <AdminPageFrame isBusy header={(
        <div className="admin-page-skeleton-header" aria-hidden="true">
          <span className="admin-skeleton admin-page-skeleton-back" />
          <span className="admin-skeleton admin-page-skeleton-account" />
        </div>
      )}>
        <div className="admin-page-skeleton-body" aria-hidden="true">
          <span className="admin-skeleton admin-page-skeleton-title" />
          <section className="admin-section">
            <div className="admin-section-heading">
              <span className="admin-skeleton admin-skeleton-heading" />
            </div>
            <PlausibleSectionSkeleton />
          </section>
          <section className="admin-section">
            <div className="admin-section-heading">
              <span className="admin-skeleton admin-skeleton-heading" />
            </div>
            <DatabaseSectionSkeleton />
          </section>
        </div>
      </AdminPageFrame>
    </>
  )
}

function MetricGridSkeleton({ count, className = 'admin-metric-grid' }: { count: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, index) => (
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
      <div className="admin-inventory-summary">
        <MetricGridSkeleton count={2} className="admin-inventory-metrics" />
        <div className="admin-status-breakdown">
          <span className="admin-skeleton admin-skeleton-label" />
          <span className="admin-skeleton admin-skeleton-status" />
        </div>
      </div>
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
      <div className="admin-pulse-summary admin-skeleton-summary-shell">
        <span className="admin-skeleton admin-skeleton-summary" />
      </div>
      <MetricGridSkeleton count={3} className="admin-pulse-grid" />
      <div className="admin-traffic-layout">
        <div className="admin-chart admin-skeleton-chart">
          <div className="admin-chart-header">
            <span className="admin-skeleton admin-skeleton-heading" />
          </div>
          <span className="admin-skeleton admin-skeleton-chart-plot" />
        </div>
        <div className="admin-traffic-details">
          <div className="admin-subheading"><span className="admin-skeleton admin-skeleton-heading" /></div>
          <span className="admin-skeleton admin-skeleton-details" />
        </div>
      </div>
      <div className="admin-actions-panel">
        <div className="admin-subheading">
          <span className="admin-skeleton admin-skeleton-heading" />
        </div>
        <div className="admin-action-groups">
          {actionGroupSizes.map((rowCount, groupIndex) => (
            <section className="admin-action-group" key={groupIndex}>
              <span className="admin-skeleton admin-skeleton-action-heading" />
              {Array.from({ length: rowCount }, (_, rowIndex) => (
                <div className="admin-action-row" key={rowIndex}>
                  <span className="admin-skeleton admin-skeleton-event-name" />
                  <span className="admin-skeleton admin-skeleton-action-track" />
                  <span className="admin-skeleton admin-skeleton-count" />
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
