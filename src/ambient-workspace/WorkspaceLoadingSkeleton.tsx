import { AmbientSkeleton } from '../ambient-skeleton'

export function WorkspaceLoadingSkeleton() {
  return (
    <main className="ambient-workspace-page" aria-busy="true">
      <h1 className="sr-only">Loading ambient workspace</h1>
      <header className="subpage-header">
        <span className="skeleton workspace-skeleton-back" />
        <span className="skeleton workspace-skeleton-meta" />
      </header>
      <div className="workspace-layout" aria-hidden="true">
        <section className="workspace-preview-panel">
          <div className="workspace-skeleton-selector">
            <span className="skeleton workspace-skeleton-selector-mark" />
            <span className="skeleton workspace-skeleton-selector-name" />
          </div>
          <div className="workspace-preview-viewport">
            <div className="workspace-preview-frame">
              <AmbientSkeleton />
            </div>
          </div>
          <span className="skeleton workspace-skeleton-help" />
        </section>
        <div className="workspace-activity-panel">
          <div className="workspace-sidebar">
            <div className="workspace-skeleton-tabs">
              <span className="skeleton workspace-skeleton-tab" />
              <span className="skeleton workspace-skeleton-tab" />
            </div>
            <div className="workspace-skeleton-panel">
              <span className="skeleton workspace-skeleton-line" />
              <span className="skeleton workspace-skeleton-line" />
              <span className="skeleton workspace-skeleton-line" />
              <span className="skeleton workspace-skeleton-action" />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
