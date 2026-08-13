import { WorkspaceTaskCard } from './WorkspaceTaskCard'

type ReviewActionsProps = {
  canCompare: boolean
  canSave: boolean
  discardLabel: string
  draftMeta?: string
  isGuest: boolean
  isSaving: boolean
  onCompare: () => void
  onDiscard: () => void
  onSave: () => void
  onSignInToSave: () => void
}

export function ReviewActions({
  canCompare,
  canSave,
  discardLabel,
  draftMeta,
  isGuest,
  isSaving,
  onCompare,
  onDiscard,
  onSave,
  onSignInToSave,
}: ReviewActionsProps) {
  if (!canSave && !isSaving && !canCompare) return null

  return (
    <WorkspaceTaskCard
      heading="Review the working draft"
      description={isGuest
        ? 'Check the preview. Sign in when you are ready to save this version.'
        : 'Check the preview. Save it as a version when it is ready.'}
      meta={draftMeta}
      actions={(
        <>
          {(canSave || isSaving) && (
            isGuest ? (
              <button className="ui-button ui-button-primary" type="button" onClick={onSignInToSave}>
                Sign in and save
              </button>
            ) : (
              <button
                className="ui-button ui-button-primary"
                type="button"
                disabled={!canSave || isSaving}
                onClick={onSave}
              >
                {isSaving ? 'Saving version...' : 'Save version'}
              </button>
            )
          )}
          {canCompare && (
            <button className="ui-button" type="button" onClick={onCompare}>
              Compare with version in use
            </button>
          )}
        </>
      )}
      footer={(
        <button className="workspace-danger-link" type="button" onClick={onDiscard}>
          {discardLabel}
        </button>
      )}
    />
  )
}
