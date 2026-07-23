import { useState } from 'react'
import { ConfirmDialog } from '../../../ui/confirm-dialog'
import type { AmbientDefinition } from '../../rendering/ambient-themes'
import type { AmbientVersion } from '../ambient-workspace-service'
import {
  PreviewCustomizationStrip,
  usePreviewCustomizations,
  type PreviewCustomizations,
} from './PreviewCustomizationStrip'
import { AmbientFramePreview } from './WorkingDraftPreview'

type DraftVersionComparisonProps = {
  draftCustomizations: PreviewCustomizations
  draftDefinition: AmbientDefinition | null
  isRestoring: boolean
  onClose: () => void
  onRestore: () => Promise<void>
  version: AmbientVersion
  versionDefinition: AmbientDefinition | null
}

export function DraftVersionComparison({
  draftCustomizations,
  draftDefinition,
  isRestoring,
  onClose,
  onRestore,
  version,
  versionDefinition,
}: DraftVersionComparisonProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const versionCustomizations = usePreviewCustomizations()
  const declarativeDraft = draftDefinition?.kind === 'declarative' ? draftDefinition : null
  const declarativeVersion = versionDefinition?.kind === 'declarative' ? versionDefinition : null

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
          {declarativeDraft && (
            <PreviewCustomizationStrip
              customizations={draftCustomizations}
              label="Draft customizations"
              slots={declarativeDraft.manifest.customizations}
            />
          )}
          {declarativeDraft
            ? <AmbientFramePreview ambientName="Working draft" compact customizationValues={draftCustomizations.values} definition={declarativeDraft} previewTitle="Ambient comparison" />
            : <div className="comparison-mark"><span>No working draft</span></div>}
        </article>
        <article>
          <h3>Version {version.version}{version.isInUse ? ' in use' : ''}</h3>
          {declarativeVersion && (
            <PreviewCustomizationStrip
              customizations={versionCustomizations}
              label="Version customizations"
              slots={declarativeVersion.manifest.customizations}
            />
          )}
          {declarativeVersion
            ? <AmbientFramePreview ambientName={`Version ${version.version}`} compact customizationValues={versionCustomizations.values} definition={declarativeVersion} previewTitle="Ambient comparison" />
            : <div className="comparison-mark"><span>Preview unavailable</span></div>}
        </article>
      </div>
      <button className="ui-button" type="button" onClick={() => setIsConfirming(true)}>
        Start draft from Version {version.version}
      </button>
      <ConfirmDialog
        confirmLabel={isRestoring ? 'Starting draft...' : `Start from Version ${version.version}`}
        description="Current draft changes will be replaced. Saved version history will remain intact."
        eyebrow="Version restore"
        isBusy={isRestoring}
        isOpen={isConfirming}
        title="Replace the working draft?"
        onCancel={() => setIsConfirming(false)}
        onConfirm={async () => {
          await onRestore()
          setIsConfirming(false)
        }}
      />
    </section>
  )
}
