import type { AmbientWorkspaceView } from './agent-workflow-machine'

const labels: Record<AmbientWorkspaceView['status'], string> = {
  setup: 'Draft setup',
  'prompt-ready': 'Prompt ready',
  waiting: 'Waiting for agent changes',
  'review-ready': 'Ready to review',
  saving: 'Saving version',
  saved: 'Draft matches saved version',
  offline: 'Offline',
  'request-error': 'Request failed',
}

export function WorkspaceActivityIndicator({
  status,
  changeCount = 0,
}: {
  status: AmbientWorkspaceView['status']
  changeCount?: number
}) {
  return (
    <span className="workspace-activity-indicator" data-status={status}>
      <span className="workspace-activity-dot" aria-hidden="true" />
      {labels[status]}
      {changeCount > 0 && <span className="workspace-activity-count">{changeCount}</span>}
    </span>
  )
}
