type AmbientWorkspaceHeaderProps = {
  versionInUse: number | null
  onClose: () => void
}

export function AmbientWorkspaceHeader({
  versionInUse,
  onClose,
}: AmbientWorkspaceHeaderProps) {
  return (
    <header className="ambient-workspace-header">
      <button className="workspace-exit-button" type="button" aria-label="Return to screenshot editor" onClick={onClose}>
        <span className="workspace-exit-arrow" aria-hidden="true">←</span>
        <span className="workspace-back-label">Back to editor</span>
      </button>
      {versionInUse !== null && (
        <div className="workspace-header-state" aria-label="Version in use">
          Version {versionInUse} in use
        </div>
      )}
    </header>
  )
}
