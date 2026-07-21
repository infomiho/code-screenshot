import { ConfirmDialog } from '../confirm-dialog'

type DiscardDraftDialogProps = {
  draftMatchesVersion: boolean
  isDiscarding: boolean
  isOpen: boolean
  onCancel: () => void
  onConfirm: () => void
  versionInUse: number | null
}

export function DiscardDraftDialog({
  draftMatchesVersion,
  isDiscarding,
  isOpen,
  onCancel,
  onConfirm,
  versionInUse,
}: DiscardDraftDialogProps) {
  const neverSaved = versionInUse === null
  const closingSyncedDraft = !neverSaved && draftMatchesVersion
  const heading = neverSaved
    ? 'Discard this ambient?'
    : closingSyncedDraft ? 'Close the working draft?' : 'Discard draft changes?'
  const description = neverSaved
    ? 'This ambient has never been saved. Discarding permanently removes it and ends agent access.'
    : closingSyncedDraft
      ? `The draft matches Version ${versionInUse}, so nothing is lost. Agent access ends; you can start a new draft anytime.`
      : `Return to Version ${versionInUse} and end current agent access. Version ${versionInUse} will remain available.`
  const confirmLabel = neverSaved
    ? 'Discard ambient'
    : closingSyncedDraft ? 'Close draft' : 'Discard changes'
  const busyLabel = closingSyncedDraft ? 'Closing...' : 'Discarding...'

  return (
    <ConfirmDialog
      confirmLabel={isDiscarding ? busyLabel : confirmLabel}
      description={description}
      eyebrow={closingSyncedDraft ? 'Finish editing' : 'Permanent action'}
      isBusy={isDiscarding}
      isDanger
      isOpen={isOpen}
      title={heading}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}
