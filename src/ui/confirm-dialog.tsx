import { AlertDialog } from '@base-ui/react/alert-dialog'
import type { ReactNode } from 'react'
import './confirm-dialog.css'

type ConfirmDialogProps = {
  confirmLabel: string
  description: ReactNode
  eyebrow: string
  isBusy: boolean
  isDanger?: boolean
  isOpen: boolean
  title: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  confirmLabel,
  description,
  eyebrow,
  isBusy,
  isDanger = false,
  isOpen,
  title,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const closeUnlessBusy = (open: boolean) => {
    if (!open && !isBusy) {
      onCancel()
    }
  }

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={closeUnlessBusy}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="confirm-dialog-backdrop" />
        <AlertDialog.Popup className="confirm-dialog">
          <span className="confirm-dialog-eyebrow">{eyebrow}</span>
          <AlertDialog.Title className="confirm-dialog-title">{title}</AlertDialog.Title>
          <AlertDialog.Description className="confirm-dialog-description">
            {description}
          </AlertDialog.Description>
          <div className="confirm-dialog-actions">
            <AlertDialog.Close className="ui-button" disabled={isBusy}>
              Cancel
            </AlertDialog.Close>
            <button
              className={isDanger ? 'confirm-dialog-danger-button' : 'ui-button ui-button-primary'}
              type="button"
              disabled={isBusy}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
