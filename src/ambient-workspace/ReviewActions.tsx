type ReviewActionsProps = {
  canCompare: boolean
  canSave: boolean
  isSaving: boolean
  onCompare: () => void
  onSave: () => void
}

export function ReviewActions({
  canCompare,
  canSave,
  isSaving,
  onCompare,
  onSave,
}: ReviewActionsProps) {
  if (!canSave && !isSaving && !canCompare) return null

  return (
    <section className="workspace-card workspace-review-actions" aria-labelledby="review-actions-heading">
      <span className="workspace-eyebrow">Next step</span>
      <h2 id="review-actions-heading">Review the working draft</h2>
      <p>Save an immutable version when the preview is ready to use.</p>
      {(canSave || isSaving) && (
        <button
          className="ui-button ui-button-primary workspace-primary-action"
          type="button"
          disabled={!canSave || isSaving}
          onClick={onSave}
        >
          {isSaving ? 'Saving version...' : 'Save version'}
        </button>
      )}
      {canCompare && (
        <button className="ui-button" type="button" onClick={onCompare}>
          Compare with version in use
        </button>
      )}
    </section>
  )
}
