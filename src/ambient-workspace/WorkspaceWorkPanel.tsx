import type {
  AgentAccessView,
  AmbientWorkspaceView,
  DraftSafetyView,
} from './agent-workflow-machine'
import { AgentPromptCard } from './AgentPromptCard'
import { ReviewActions } from './ReviewActions'
import { WorkspaceStatusCard } from './WorkspaceStatusCard'

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
  onStatus: (message: string) => void
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
  onStatus,
}: WorkspaceWorkPanelProps) {
  const hasPrompt = access.status === 'available' && agentAccessUrl !== null
  const promptIsNext = view.status === 'prompt-ready' || view.status === 'waiting'
  const reviewIsNext = view.status === 'review-ready' || view.status === 'saving'
  const connectionIsNext = view.status === 'offline' || view.status === 'request-error'
  const accessIsNext = !hasPrompt && !reviewIsNext && !connectionIsNext

  const prompt = hasPrompt ? (
    <AgentPromptCard
      agentAccessUrl={agentAccessUrl}
      ambientName={ambientName}
      hasSavedVersion={versionInUse !== null}
      isPrimary={promptIsNext || view.status === 'saved'}
      onCopied={onCopyPrompt}
      onStatus={onStatus}
    />
  ) : null
  const statusIsNext = connectionIsNext || accessIsNext
  const status = (
    <WorkspaceStatusCard
      access={access}
      agentAccessUrl={agentAccessUrl}
      canMutate={canMutate}
      discardLabel={discardLabel}
      hasWorkingDraft={hasWorkingDraft}
      safety={draftSafety}
      versionInUse={versionInUse}
      view={view}
      onCreateAccess={onCreateAccess}
      onDiscardAccess={onDiscardAccess}
      onDiscardDraft={onDiscardDraft}
      onRetry={onRetry}
    />
  )
  const review = (
    <ReviewActions
      canCompare={canCompare}
      canSave={canSave}
      isSaving={isSaving}
      onCompare={onCompare}
      onSave={onSave}
    />
  )

  return (
    <div className="workspace-work-panel">
      {statusIsNext && status}
      {reviewIsNext && review}
      {promptIsNext && prompt}

      {!statusIsNext && status}
      {!promptIsNext && prompt}

    </div>
  )
}
