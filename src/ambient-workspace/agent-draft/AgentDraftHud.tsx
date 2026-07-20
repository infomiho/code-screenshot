import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentDraftModel } from '../ambient-workspace-service'
import type { AgentAccessState, AgentMutationState } from '../agent-workflow-machine'
import { AgentDockPortal } from './AgentDockPortal'
import { AgentDraftContent } from './AgentDraftContent'
import { AgentHudTrigger } from './AgentHudTrigger'
import { AgentRecoveryNotice } from './AgentRecoveryNotice'
import { getPrompt } from './model'
import './agent-draft.css'
import './agent-draft-content.css'

type AgentDraftHudProps = {
  isOpen: boolean
  access: AgentAccessState | 'renewing'
  mutation: AgentMutationState
  model: AgentDraftModel
  onOpenChange: (isOpen: boolean) => void
  onExit: () => void
  onCopyPrompt: () => void
  onCreateAmbient: (ambientName: string) => void
  onRenewAgentAccess: () => void
  onRetryConnection: () => void
  onSavePrivateVersion: () => void
  onDiscardDraft: () => Promise<boolean>
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
  access,
  mutation,
  model,
  onOpenChange,
  onExit,
  onCopyPrompt,
  onCreateAmbient,
  onRenewAgentAccess,
  onRetryConnection,
  onSavePrivateVersion,
  onDiscardDraft,
}: AgentDraftHudProps) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const copyTimerRef = useRef<number | null>(null)
  const minimizeDock = useCallback(() => {
    onOpenChange(false)
    window.requestAnimationFrame(() => {
      triggerRef.current?.focus()
    })
  }, [onOpenChange])
  const exitEditMode = useCallback(() => {
    onExit()
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.cm-content')?.focus()
    })
  }, [onExit])

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
        <AgentDockPortal model={model} onMinimize={minimizeDock}>
          <AgentRecoveryNotice
            isRenewingAccess={access === 'renewing'}
            model={model}
            onRenewAgentAccess={onRenewAgentAccess}
            onRetryConnection={onRetryConnection}
          />
          <AgentDraftContent
            copyLabel={copyLabels[copyStatus]}
            access={access}
            isCreating={mutation === 'creating'}
            model={model}
            onExit={exitEditMode}
            onCopyPrompt={copyPrompt}
            onCreateAmbient={onCreateAmbient}
            onSavePrivateVersion={onSavePrivateVersion}
            onDiscardDraft={onDiscardDraft}
          />
          <span className="sr-only" role="status" aria-live="polite">
            {copyAnnouncements[copyStatus]}
          </span>
        </AgentDockPortal>
      )}
    </div>
  )
}
