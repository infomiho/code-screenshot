import { useEffect, useRef } from 'react'

type DiscardDraftDialogProps = {
  isDiscarding: boolean
  isOpen: boolean
  onCancel: () => void
  onConfirm: () => void
  versionInUse: number | null
}

export function DiscardDraftDialog({
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
  return (
    <dialog
      ref={dialogRef}
      className="workspace-dialog"
      aria-labelledby="discard-dialog-heading"
      aria-describedby="discard-dialog-description"
      onCancel={(event) => {
        if (isDiscarding) event.preventDefault()
        else onCancel()
      }}
    >
      <span className="workspace-eyebrow">Permanent action</span>
      <h2 id="discard-dialog-heading">{neverSaved ? 'Discard this ambient?' : 'Discard draft changes?'}</h2>
      <p id="discard-dialog-description">
        {neverSaved
          ? 'This ambient has never been saved. Discarding permanently removes it and ends agent access.'
          : `Return to Version ${versionInUse} and end current agent access. Version ${versionInUse} will remain available.`}
      </p>
      <div className="workspace-dialog-actions">
        <button ref={cancelRef} className="ui-button" type="button" disabled={isDiscarding} onClick={onCancel}>
          Cancel
        </button>
        <button className="workspace-danger-button" type="button" disabled={isDiscarding} onClick={onConfirm}>
          {isDiscarding ? 'Discarding...' : neverSaved ? 'Discard ambient' : 'Discard changes'}
        </button>
      </div>
    </dialog>
  )
}
