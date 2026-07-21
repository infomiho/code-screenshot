type AmbientWorkspaceHeaderProps = {
  versionInUse: number | null
  onClose: () => void
}

export function AmbientWorkspaceHeader({
  versionInUse,
  onClose,
}: AmbientWorkspaceHeaderProps) {
  return (
    <header className="subpage-header">
      <button className="subpage-back-button" type="button" aria-label="Your ambients" onClick={onClose}>
        <span className="subpage-back-arrow" aria-hidden="true">←</span>
        <span className="subpage-back-label">Your ambients</span>
      </button>
      {versionInUse !== null && (
        <div className="subpage-header-meta" aria-label="Version in use">
          Version {versionInUse} in use
        </div>
      )}
    </header>
  )
}
