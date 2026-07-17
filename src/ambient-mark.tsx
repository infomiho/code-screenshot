import type { AmbientDefinition } from './ambient-themes'

export function AmbientMark({ definition }: { definition: AmbientDefinition }) {
  return <span className={`ambient-mark ambient-mark--${definition.id}`} aria-hidden="true" />
}
