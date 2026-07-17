import type { AgentDraftModel } from '../ambient-workspace-service'
import { AgentButton } from './AgentButton'

type AgentRecoveryNoticeProps = {
  model: AgentDraftModel
  onRenewAgentAccess: () => void
  onRetryConnection: () => void
}

export function AgentRecoveryNotice({
  model,
  onRenewAgentAccess,
  onRetryConnection,
}: AgentRecoveryNoticeProps) {
  if (model.notice === 'rejected') {
    return (
      <aside className="agent-notice agent-notice-warning">
        <strong>Update rejected</strong>
        <p>The agent received the errors. The preview did not change.</p>
      </aside>
    )
  }

  if (model.notice === 'expired') {
    return (
      <aside className="agent-notice agent-notice-warning">
        <strong>Access expired</strong>
        <p>Create a new link to continue.</p>
        <AgentButton variant={model.phase === 'review' ? 'secondary' : 'primary'} onClick={onRenewAgentAccess}>
          Renew access
        </AgentButton>
      </aside>
    )
  }

  if (model.notice === 'unavailable') {
    return (
      <aside className="agent-notice agent-notice-warning">
        <strong>Agent link unavailable</strong>
        <p>Create a new link for this browser to continue.</p>
        <AgentButton variant={model.phase === 'review' ? 'secondary' : 'primary'} onClick={onRenewAgentAccess}>
          Create new link
        </AgentButton>
      </aside>
    )
  }

  if (model.notice === 'request-error') {
    return (
      <aside className="agent-notice agent-notice-warning">
        <strong>Request failed</strong>
        <p>Refresh the workspace and try again.</p>
        <AgentButton variant="secondary" onClick={onRetryConnection}>Refresh workspace</AgentButton>
      </aside>
    )
  }

  if (model.notice === 'offline') {
    return (
      <aside className="agent-notice">
        <strong>You're offline</strong>
        <p>Live updates and saving are paused.</p>
        <AgentButton variant="secondary" onClick={onRetryConnection}>Try again</AgentButton>
      </aside>
    )
  }

  return null
}
