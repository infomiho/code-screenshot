import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentDraftModel } from '../ambient-workspace-service'
import { AgentDockPortal } from './AgentDockPortal'
import { AgentDraftContent } from './AgentDraftContent'
import { AgentHudTrigger } from './AgentHudTrigger'
import { AgentRecoveryNotice } from './AgentRecoveryNotice'
import { getPrompt } from './model'
import './agent-draft.css'
import './agent-draft-content.css'

type AgentDraftHudProps = {
  isOpen: boolean
  model: AgentDraftModel
  onOpenChange: (isOpen: boolean) => void
  onCopyPrompt: () => void
  onCreateAmbient: (ambientName: string, designDirection: string) => void
  onRenewAgentAccess: () => void
  onRetryConnection: () => void
  onSavePrivateVersion: () => void
}

type CopyStatus = 'idle' | 'copied' | 'failed'

const copyLabels: Record<CopyStatus, string> = {
  idle: 'Copy prompt',
  copied: 'Prompt copied',
  failed: 'Copy failed',
}

const copyAnnouncements: Record<CopyStatus, string> = {
  idle: '',
  copied: 'Prompt copied.',
  failed: 'Could not copy prompt.',
}

export function AgentDraftHud({
  isOpen,
  model,
  onOpenChange,
  onCopyPrompt,
  onCreateAmbient,
  onRenewAgentAccess,
  onRetryConnection,
  onSavePrivateVersion,
}: AgentDraftHudProps) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const copyTimerRef = useRef<number | null>(null)
  const closeDock = useCallback(() => {
    onOpenChange(false)
    window.requestAnimationFrame(() => {
      if (model.phase === 'saved') {
        document.querySelector<HTMLElement>('.ambient-current')?.focus()
      } else {
        triggerRef.current?.focus()
      }
    })
  }, [model.phase, onOpenChange])

  useEffect(() => () => {
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
  }, [])

  useEffect(() => {
    setCopyStatus('idle')
  }, [model.id])

  const copyPrompt = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(getPrompt(model))
      onCopyPrompt()
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }

    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
    copyTimerRef.current = window.setTimeout(() => setCopyStatus('idle'), 2200)
  }

  return (
    <div className="agent-layer">
      {!isOpen && (
        <AgentHudTrigger
          model={model}
          onOpen={() => onOpenChange(true)}
          triggerRef={triggerRef}
        />
      )}
      {isOpen && (
        <AgentDockPortal model={model} onClose={closeDock}>
          <AgentRecoveryNotice
            model={model}
            onRenewAgentAccess={onRenewAgentAccess}
            onRetryConnection={onRetryConnection}
          />
          <AgentDraftContent
            copyLabel={copyLabels[copyStatus]}
            model={model}
            onClose={closeDock}
            onCopyPrompt={copyPrompt}
            onCreateAmbient={onCreateAmbient}
            onSavePrivateVersion={onSavePrivateVersion}
          />
          <span className="sr-only" role="status" aria-live="polite">
            {copyAnnouncements[copyStatus]}
          </span>
        </AgentDockPortal>
      )}
    </div>
  )
}
