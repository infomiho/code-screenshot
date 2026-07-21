import { loadAmbientDefinition } from '../ambient-registry'
import type { AmbientVersion } from './ambient-workspace-service'
import { VersionEntry } from './VersionEntry'

type VersionSpineProps = {
  acceptedChangeCount: number
  onSelectVersion: (versionId: string) => void
  selectedVersionId: string | null
  versions: readonly AmbientVersion[]
}

export function VersionSpine({
  acceptedChangeCount,
  onSelectVersion,
  selectedVersionId,
  versions,
}: VersionSpineProps) {
  return (
    <section className="version-spine-section" aria-labelledby="version-history-heading">
      <div className="version-spine-heading">
        <span className="workspace-eyebrow">Version history</span>
        <h2 id="version-history-heading">Saved checkpoints</h2>
      </div>
      <ol className="version-spine">
        <li className="version-entry version-entry-draft">
          <div className="version-entry-button">
            <span className="version-node" aria-hidden="true" />
            <span className="version-entry-copy">
              <strong>Working draft</strong>
              <span>{acceptedChangeCount} accepted {acceptedChangeCount === 1 ? 'change' : 'changes'}</span>
            </span>
          </div>
        </li>
        {versions.map((version) => (
          <VersionEntry
            key={version.id}
            definition={loadAmbientDefinition(version, 'saved').definition}
            isSelected={version.id === selectedVersionId}
            onSelect={() => onSelectVersion(version.id)}
            version={version}
          />
        ))}
      </ol>
      {versions.length === 0 && <p className="version-empty">Save this draft to create Version 1.</p>}
    </section>
  )
}
