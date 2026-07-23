import { AmbientMark } from '../../rendering/ambient-mark'
import type { AmbientDefinition } from '../../rendering/ambient-themes'
import type { AmbientVersion } from '../ambient-workspace-service'

const formatVersionDate = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value))

export function VersionEntry({
  definition,
  isSelected,
  onSelect,
  version,
}: {
  definition: AmbientDefinition | null
  isSelected: boolean
  onSelect: () => void
  version: AmbientVersion
}) {
  return (
    <li className="version-entry">
      <button
        className="version-entry-button"
        type="button"
        aria-pressed={isSelected}
        onClick={onSelect}
      >
        <span className="version-node" aria-hidden="true" />
        {definition && <span className="version-thumbnail"><AmbientMark definition={definition} /></span>}
        <span className="version-entry-copy">
          <strong>Version {version.version}</strong>
          <span>{formatVersionDate(version.createdAt)}</span>
        </span>
        {version.isInUse && <span className="version-in-use">In use</span>}
      </button>
    </li>
  )
}
