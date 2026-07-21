import { useEffect, useRef, useState } from 'react'
import type { AmbientDefinition } from '../ambient-themes'
import type { AmbientVersion } from './ambient-workspace-service'
import { AmbientFramePreview } from './WorkingDraftPreview'

type DraftVersionComparisonProps = {
  draftDefinition: AmbientDefinition | null
  isRestoring: boolean
  onClose: () => void
  onRestore: () => Promise<void>
  version: AmbientVersion
  versionDefinition: AmbientDefinition | null
}

export function DraftVersionComparison({
  draftDefinition,
  isRestoring,
  onClose,
  onRestore,
  version,
  versionDefinition,
}: DraftVersionComparisonProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isConfirming) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    dialogRef.current?.showModal()
    cancelRef.current?.focus()
    return () => {
      dialogRef.current?.close()
      previousFocusRef.current?.focus()
    }
  }, [isConfirming])

  return (
    <section className="draft-comparison" aria-labelledby="draft-comparison-heading">
      <div className="draft-comparison-header">
        <div>
          <span className="workspace-eyebrow">Version preview</span>
          <h2 id="draft-comparison-heading">Draft and Version {version.version}</h2>
        </div>
        <button className="workspace-link-button" type="button" onClick={onClose}>Close comparison</button>
      </div>
      <div className="draft-comparison-grid">
        <article>
          <h3>Working draft</h3>
          {draftDefinition?.kind === 'declarative'
            ? <AmbientFramePreview ambientName="Working draft" compact definition={draftDefinition} previewTitle="Ambient comparison" />
            : <div className="comparison-mark"><span>No working draft</span></div>}
        </article>
        <article>
          <h3>Version {version.version}{version.isInUse ? ' in use' : ''}</h3>
          {versionDefinition?.kind === 'declarative'
            ? <AmbientFramePreview ambientName={`Version ${version.version}`} compact definition={versionDefinition} previewTitle="Ambient comparison" />
            : <div className="comparison-mark"><span>Preview unavailable</span></div>}
        </article>
      </div>
      <button className="ui-button" type="button" onClick={() => setIsConfirming(true)}>
        Start draft from Version {version.version}
      </button>
      {isConfirming && (
        <dialog
          ref={dialogRef}
          className="workspace-dialog workspace-restore-dialog"
          aria-labelledby="restore-dialog-heading"
          onCancel={() => setIsConfirming(false)}
        >
          <h3 id="restore-dialog-heading">Replace the working draft?</h3>
          <p>Current draft changes will be replaced. Saved version history will remain intact.</p>
          <div className="workspace-dialog-actions">
            <button ref={cancelRef} className="ui-button" type="button" onClick={() => setIsConfirming(false)}>
              Cancel
            </button>
            <button
              className="ui-button ui-button-primary"
              type="button"
              disabled={isRestoring}
              onClick={async () => {
                await onRestore()
                setIsConfirming(false)
              }}
            >
              {isRestoring ? 'Starting draft...' : `Start from Version ${version.version}`}
            </button>
          </div>
        </dialog>
      )}
    </section>
  )
}
