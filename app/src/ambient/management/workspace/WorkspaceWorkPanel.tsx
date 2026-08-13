import type {
  AgentAccessView,
  AmbientWorkspaceView,
  DraftSafetyView,
} from '../agent/agent-workflow-machine'
import { AgentPromptCard } from '../agent/AgentPromptCard'
import { AgentAccessControl } from './AgentAccessControl'
import { ReviewActions } from './ReviewActions'
import { WorkspaceTaskCard } from './WorkspaceTaskCard'

type WorkspaceWorkPanelProps = {
  access: AgentAccessView
  agentAccessUrl: string | null
  ambientName: string
  canCompare: boolean
  canMutate: boolean
  canSave: boolean
  discardLabel: string
  draftSafety: DraftSafetyView
  hasWorkingDraft: boolean
  isGuest: boolean
  isSaving: boolean
  versionInUse: number | null
  view: AmbientWorkspaceView
  onCompare: () => void
  onCopyPrompt: () => void
  onCreateAccess: () => void
  onDiscardAccess: () => void
  onDiscardDraft: () => void
  onRetry: () => void
  onSave: () => void
  onSignInToSave: () => void
}

const getPromptVariant = (
  status: AmbientWorkspaceView['status'],
  agentConnected: boolean,
  hasSavedVersion: boolean,
) => {
  if (status === 'saved') return 'saved'
  if (status === 'prompt-ready' && hasSavedVersion) return 'update'
  if (status === 'review-ready' || status === 'saving') return 'review'
  if (agentConnected) return 'connected'
  return 'next'
}

const getDraftMeta = (safety: DraftSafetyView) => {
  if (safety.status === 'different-from-version') return `Differs from Version ${safety.version}`
  if (safety.status === 'based-on-version') return `Started from Version ${safety.sourceVersion}`
  if (safety.status === 'ahead-of-version') return `Ahead of Version ${safety.version}`
  return undefined
}

export function WorkspaceWorkPanel({
  access,
  agentAccessUrl,
  ambientName,
  canCompare,
  canMutate,
  canSave,
  discardLabel,
  draftSafety,
  hasWorkingDraft,
  isGuest,
  isSaving,
  versionInUse,
  view,
  onCompare,
  onCopyPrompt,
  onCreateAccess,
  onDiscardAccess,
  onDiscardDraft,
  onRetry,
  onSave,
  onSignInToSave,
}: WorkspaceWorkPanelProps) {
  const hasPrompt = access.status === 'available' && agentAccessUrl !== null
  const agentConnected = access.status === 'available' && access.hasReadDraft
  const promptIsNext = view.status === 'prompt-ready'
  const promptVariant = getPromptVariant(view.status, agentConnected, versionInUse !== null)
  const draftMeta = getDraftMeta(draftSafety)
  const discardAction = hasWorkingDraft ? (
    <button
      className="workspace-danger-link"
      type="button"
      disabled={!canMutate}
      onClick={onDiscardDraft}
    >
      {discardLabel}
    </button>
  ) : null

  const prompt = hasPrompt ? (
    <AgentPromptCard
      agentAccessUrl={agentAccessUrl}
      ambientName={ambientName}
      hasSavedVersion={versionInUse !== null}
      isPrimary={promptIsNext}
      footer={promptIsNext ? discardAction : undefined}
      variant={promptVariant}
      onCopied={onCopyPrompt}
    />
  ) : null
  const review = (
    <ReviewActions
      canCompare={canCompare}
      canSave={canSave}
      discardLabel={discardLabel}
      draftMeta={draftMeta}
      isGuest={isGuest}
      isSaving={isSaving}
      onCompare={onCompare}
      onDiscard={onDiscardDraft}
      onSave={onSave}
      onSignInToSave={onSignInToSave}
    />
  )
  const prepareAccess = (
    <WorkspaceTaskCard
      heading="Prepare the agent prompt"
      description="Create temporary agent access to generate a prompt for this theme."
      actions={(
        <button
          className="ui-button ui-button-primary"
          type="button"
          disabled={!canMutate || access.status === 'creating'}
          onClick={onCreateAccess}
        >
          {access.status === 'creating' ? 'Creating access...' : 'Create agent access'}
        </button>
      )}
      footer={discardAction}
    />
  )

  const task = (() => {
    switch (view.status) {
      case 'offline':
      case 'request-error':
        return (
          <WorkspaceTaskCard
            heading="Unable to update the workspace"
            description="Check your connection and try again. Your draft remains available."
            actions={<button className="ui-button ui-button-primary" type="button" onClick={onRetry}>Retry connection</button>}
            footer={discardAction}
          />
        )
      case 'review-ready':
      case 'saving':
        return review
      case 'prompt-ready':
        return prompt ?? prepareAccess
      case 'waiting':
        return (
          <WorkspaceTaskCard
            heading={agentConnected ? 'Waiting for changes' : 'Waiting for your agent'}
            description={agentConnected
              ? 'Your agent is connected and can send changes back here.'
              : 'Paste the copied prompt into your coding agent to connect it.'}
            footer={discardAction}
          />
        )
      case 'saved':
        return (
          <WorkspaceTaskCard
            heading={`Version ${versionInUse} is in use`}
            description="This version is available in the screenshot editor."
            actions={<button className="ui-button ui-button-primary" type="button" onClick={onCreateAccess}>Start another update</button>}
            footer={discardAction}
          />
        )
      case 'setup':
        return prepareAccess
    }
  })()

  return (
    <div className="workspace-work-panel">
      {task}
      <AgentAccessControl
        access={access}
        canMutate={canMutate}
        hasAccessUrl={agentAccessUrl !== null}
        onEndAccess={onDiscardAccess}
      />
      {!promptIsNext && prompt}
    </div>
  )
}
