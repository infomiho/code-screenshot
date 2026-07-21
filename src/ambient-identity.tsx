import { AmbientMark } from './ambient-mark'
import type { AmbientDefinition } from './ambient-themes'

type AmbientIdentityProps = {
  definition: AmbientDefinition
  meta: string
  name?: string
  showDisclosure?: boolean
}

export function AmbientIdentity({
  definition,
  meta,
  name = definition.manifest.name,
  showDisclosure = false,
}: AmbientIdentityProps) {
  return (
    <span className="ambient-identity">
      <AmbientMark definition={definition} />
      <span className="ambient-current-copy">
        <span className="ambient-current-name">{name}</span>
        <span className="ambient-current-position">{meta}</span>
      </span>
      {showDisclosure && <span className="ambient-disclosure" aria-hidden="true" />}
    </span>
  )
}
