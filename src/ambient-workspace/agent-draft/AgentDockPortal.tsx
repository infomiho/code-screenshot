import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { AgentDraftModel } from '../ambient-workspace-service'
import { getHudStatus } from './model'

type AgentDockPortalProps = {
  children: ReactNode
  model: AgentDraftModel
  onClose: () => void
}

export function AgentDockPortal({ children, model, onClose }: AgentDockPortalProps) {
  const dockRef = useRef<HTMLElement>(null)
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)
  const dockKind = model.phase === 'setup' || model.phase === 'saved' ? 'ambient' : 'draft'
  const closeDock = useEffectEvent(onClose)

  useEffect(() => {
    setPortalRoot(document.body)
  }, [])

  useEffect(() => {
    if (!portalRoot) return

    const focusFrame = window.requestAnimationFrame(() => {
      dockRef.current?.querySelector<HTMLElement>('[data-dock-focus]')?.focus()
    })
    return () => window.cancelAnimationFrame(focusFrame)
  }, [portalRoot])

  useEffect(() => {
    if (!portalRoot) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeDock()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [portalRoot])

  if (!portalRoot) return null

  return createPortal(
    <section
      ref={dockRef}
      id="agent-draft-dock"
      className="agent-layer agent-dock"
      data-phase={model.phase}
      aria-labelledby="agent-dock-title"
      aria-describedby="agent-dock-status"
    >
      <header className="agent-dock-header">
        <div className="agent-dock-heading">
          <span>Agent {dockKind}</span>
          <h2 id="agent-dock-title" title={model.ambientName ?? 'New ambient'}>
            {model.ambientName ?? 'New ambient'}
          </h2>
        </div>
        <p id="agent-dock-status" role="status" aria-live="polite" aria-atomic="true">
          {getHudStatus(model)}
        </p>
        <button
          className="agent-dock-close"
          data-dock-focus={model.phase === 'setup' ? undefined : true}
          type="button"
          onClick={onClose}
        >
          Close
        </button>
      </header>
      <div className="agent-dock-body">{children}</div>
    </section>,
    portalRoot,
  )
}
