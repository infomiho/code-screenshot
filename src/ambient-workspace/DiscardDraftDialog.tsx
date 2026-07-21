import { useEffect, useRef } from 'react'

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
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    dialogRef.current?.showModal()
    cancelRef.current?.focus()
    return () => {
      dialogRef.current?.close()
      previousFocusRef.current?.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

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

  return (
    <dialog
      ref={dialogRef}
      className="workspace-dialog"
      aria-labelledby="discard-dialog-heading"
      aria-describedby="discard-dialog-description"
      onCancel={(event) => {
        if (isDiscarding) {
          event.preventDefault()
        } else {
          onCancel()
        }
      }}
    >
      <span className="workspace-eyebrow">{closingSyncedDraft ? 'Finish editing' : 'Permanent action'}</span>
      <h2 id="discard-dialog-heading">{heading}</h2>
      <p id="discard-dialog-description">{description}</p>
      <div className="workspace-dialog-actions">
        <button ref={cancelRef} className="ui-button" type="button" disabled={isDiscarding} onClick={onCancel}>
          Cancel
        </button>
        <button className="workspace-danger-button" type="button" disabled={isDiscarding} onClick={onConfirm}>
          {isDiscarding ? (closingSyncedDraft ? 'Closing...' : 'Discarding...') : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
