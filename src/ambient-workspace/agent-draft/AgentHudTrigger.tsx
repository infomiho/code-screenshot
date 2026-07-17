import type { RefObject } from 'react'
import type { AgentDraftModel } from '../ambient-workspace-service'
import { getHudStatus } from './model'

type AgentHudTriggerProps = {
  model: AgentDraftModel
  onOpen: () => void
  triggerRef: RefObject<HTMLButtonElement | null>
}

export function AgentHudTrigger({ model, onOpen, triggerRef }: AgentHudTriggerProps) {
  return (
    <button
      className="agent-dock-trigger"
      ref={triggerRef}
      type="button"
      aria-controls="agent-draft-dock"
      aria-expanded="false"
      onClick={onOpen}
    >
      <span className="agent-dock-identity">Agent draft</span>
      <strong className="agent-dock-name" title={model.ambientName ?? 'New ambient'}>
        {model.ambientName ?? 'New ambient'}
      </strong>
      <span className="agent-dock-trigger-status" role="status" aria-live="polite" aria-atomic="true">
        {getHudStatus(model)}
      </span>
      <span className="agent-dock-open">Open</span>
    </button>
  )
}
