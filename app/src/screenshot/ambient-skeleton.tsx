import { EditorSkeleton } from './editor-skeleton'

export function AmbientSkeleton() {
  return (
    <div className="ambient-skeleton" aria-hidden="true">
      <div className="ambient-skeleton-window">
        <div className="ambient-skeleton-bar">
          <span className="ambient-skeleton-dot" />
          <span className="ambient-skeleton-dot" />
          <span className="ambient-skeleton-dot" />
          <span className="skeleton ambient-skeleton-title" />
        </div>
        <div className="ambient-skeleton-body">
          <EditorSkeleton />
        </div>
      </div>
    </div>
  )
}
