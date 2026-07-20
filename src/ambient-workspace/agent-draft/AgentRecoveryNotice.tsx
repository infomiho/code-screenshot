import type { AgentDraftModel } from '../ambient-workspace-service'
import { AgentButton } from './AgentButton'

type AgentRecoveryNoticeProps = {
  isRenewingAccess: boolean
  model: AgentDraftModel
  onRenewAgentAccess: () => void
  onRetryConnection: () => void
}

export function AgentRecoveryNotice({
  isRenewingAccess,
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
        <AgentButton
          variant={model.phase === 'review' ? 'secondary' : 'primary'}
          isDisabled={isRenewingAccess}
          onClick={onRenewAgentAccess}
        >
          {isRenewingAccess ? 'Renewing...' : 'Renew access'}
        </AgentButton>
      </aside>
    )
  }

  if (model.notice === 'unavailable') {
    return (
      <aside className="agent-notice agent-notice-warning">
        <strong>Agent link unavailable</strong>
        <p>Create a new link for this browser to continue.</p>
        <AgentButton
          variant={model.phase === 'review' ? 'secondary' : 'primary'}
          isDisabled={isRenewingAccess}
          onClick={onRenewAgentAccess}
        >
          {isRenewingAccess ? 'Creating link...' : 'Create new link'}
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
