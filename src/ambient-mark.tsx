import type { AmbientDefinition } from './ambient-themes'

export function AmbientMark({ definition }: { definition: AmbientDefinition }) {
  const markerClass = definition.source === 'built-in'
    ? `ambient-mark--${definition.id}`
    : 'ambient-mark--user'

  return <span className={`ambient-mark ${markerClass}`} aria-hidden="true" />
}
