import { useState } from 'react'
import type { AgentDraftModel } from '../ambient-workspace-service'
import type { AgentAccessState } from '../agent-workflow-machine'
import { AgentButton } from './AgentButton'
import { AgentPrompt } from './AgentPrompt'
import { AmbientSetupForm } from './AmbientSetupForm'
import { formatExpiry } from './model'

type AgentDraftContentProps = {
  copyLabel: string
  access: AgentAccessState | 'renewing'
  isCreating: boolean
  model: AgentDraftModel
  onExit: () => void
  onCopyPrompt: () => void
  onCreateAmbient: (ambientName: string) => void
  onSavePrivateVersion: () => void
  onDiscardDraft: () => Promise<boolean>
}

function DiscardDraftAction({ onDiscard }: { onDiscard: () => Promise<boolean> }) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [isDiscarding, setIsDiscarding] = useState(false)

  if (!isConfirming) {
    return <AgentButton variant="danger" onClick={() => setIsConfirming(true)}>Discard draft</AgentButton>
  }

  const discard = async () => {
    setIsDiscarding(true)
    const discarded = await onDiscard()
    if (!discarded) setIsDiscarding(false)
  }

  return (
    <div className="agent-discard-confirmation">
      <p>Discard unsaved changes and end agent access?</p>
      <div>
        <AgentButton isDisabled={isDiscarding} onClick={() => setIsConfirming(false)}>Keep draft</AgentButton>
        <AgentButton variant="danger" isDisabled={isDiscarding} onClick={discard}>
          {isDiscarding ? 'Discarding...' : 'Discard'}
        </AgentButton>
      </div>
    </div>
  )
}

const getPromptAction = (model: AgentDraftModel, copyLabel: string) => {
  if (model.notice === 'expired') return { label: 'Prompt expired', isDisabled: true }
  if (model.notice === 'unavailable') return { label: 'Link unavailable', isDisabled: true }
  return { label: copyLabel, isDisabled: false }
}

export function AgentDraftContent({
  copyLabel,
  access,
  isCreating,
  model,
  onExit,
  onCopyPrompt,
  onCreateAmbient,
  onSavePrivateVersion,
  onDiscardDraft,
}: AgentDraftContentProps) {
  const isOffline = model.notice === 'offline'
  const promptAction = getPromptAction(model, copyLabel)
  const hasAgentAccess = access === 'available'
  const prompt = hasAgentAccess
    ? (
        <AgentPrompt
          copyLabel={promptAction.label}
          isDisabled={promptAction.isDisabled}
          model={model}
          onCopyPrompt={onCopyPrompt}
        />
      )
    : null
  const workLayoutClass = `agent-work-layout${prompt ? '' : ' agent-work-layout-single'}`

  if (model.phase === 'setup') {
    return (
      <div className="agent-setup-layout">
        <AmbientSetupForm isCreating={isCreating} onCreateAmbient={onCreateAmbient} />
        <section className="agent-next-steps" aria-labelledby="agent-next-title">
          <h3 id="agent-next-title">Next</h3>
          <ol>
            <li>Copy the prompt.</li>
            <li>Paste it into an agent chat.</li>
            <li>Review and save the result.</li>
          </ol>
          <p>Access lasts 24 hours and only works for this draft.</p>
        </section>
      </div>
    )
  }

  if (model.phase === 'handoff') {
    return (
      <div className={workLayoutClass}>
        {prompt}
        <section className="agent-status-panel" aria-labelledby="agent-handoff-title">
          <div className="agent-copy">
            <h3 id="agent-handoff-title">Send to your agent</h3>
            <p>Copy the prompt and paste it into an agent chat.</p>
          </div>
          <div className="agent-status-block">
            <span>Waiting for changes</span>
            <strong>{model.promptCopied ? 'Prompt copied' : 'No changes yet'}</strong>
          </div>
          <div className="agent-secondary-actions">
            <AgentButton variant="quiet" onClick={onExit}>Exit edit mode</AgentButton>
            <DiscardDraftAction onDiscard={onDiscardDraft} />
          </div>
          <div className="agent-access-block">
            <span>Access ends</span>
            <strong>{formatExpiry(model.promptExpiresAt)}</strong>
            <p>Only this draft can be updated.</p>
          </div>
        </section>
      </div>
    )
  }

  if (model.phase === 'review') {
    const isSaving = model.saveState === 'saving'
    return (
      <div className={workLayoutClass}>
        {prompt}
        <section className="agent-status-panel" aria-labelledby="agent-review-title">
          <div className="agent-copy">
            <h3 id="agent-review-title">Ready to review</h3>
            <p>Check the preview, then save this version.</p>
          </div>
          <div className="agent-review-actions">
            <AgentButton
              variant="primary"
              isDisabled={isOffline || isSaving}
              onClick={onSavePrivateVersion}
            >
              {isSaving ? 'Saving...' : 'Save private version'}
            </AgentButton>
            <div className="agent-secondary-actions">
              <AgentButton variant="quiet" onClick={onExit}>Exit edit mode</AgentButton>
              <DiscardDraftAction onDiscard={onDiscardDraft} />
            </div>
          </div>
          <div className="agent-access-block">
            <span>Access ends</span>
            <strong>{formatExpiry(model.promptExpiresAt)}</strong>
            <p>Only this draft can be updated.</p>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className={workLayoutClass}>
      {prompt}
      <section className="agent-status-panel" aria-labelledby="agent-saved-title">
        <div className="agent-copy">
          <h3 id="agent-saved-title">Private version saved</h3>
          <p>{model.ambientName} is saved and selected.</p>
          <p>Copy the prompt again to continue this agent session.</p>
        </div>
        <AgentButton variant="quiet" onClick={onExit}>Exit edit mode</AgentButton>
        <div className="agent-access-block">
          <span>Access ends</span>
          <strong>{formatExpiry(model.promptExpiresAt)}</strong>
          <p>New accepted changes return here for another review.</p>
        </div>
      </section>
    </div>
  )
}
