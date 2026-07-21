import type {
  AgentAccessView,
  AmbientWorkspaceView,
  DraftSafetyView,
} from './agent-workflow-machine'
import { WorkspaceActivityIndicator } from './WorkspaceActivityIndicator'

const formatExpiry = (expiresAt: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(expiresAt))

const safetyLabel = (safety: DraftSafetyView) => {
  if (safety.status === 'never-saved') return 'Never saved'
  if (safety.status === 'matches-version') return `Version ${safety.version} in use`
  if (safety.status === 'different-from-version') return `Version ${safety.version} in use`
  if (safety.status === 'based-on-version') {
    return `From Version ${safety.sourceVersion} · ${safety.changeCount} ${safety.changeCount === 1 ? 'change' : 'changes'} · Version ${safety.versionInUse} in use`
  }
  return `${safety.changeCount} ${safety.changeCount === 1 ? 'change' : 'changes'} ahead of Version ${safety.version}`
}

const accessLabel = (access: AgentAccessView, hasAccessUrl: boolean) => {
  if (access.status === 'available' && hasAccessUrl) return `Access until ${formatExpiry(access.expiresAt)}`
  if (access.status === 'creating') return 'Creating access...'
  if (access.status === 'expired') return 'Access ended'
  if (access.status === 'available' || access.status === 'unavailable') return 'New access required'
  return 'No agent access'
}

type WorkspaceStatusCardProps = {
  access: AgentAccessView
  agentAccessUrl: string | null
  canMutate: boolean
  discardLabel: string
  safety: DraftSafetyView
  view: AmbientWorkspaceView
  onCreateAccess: () => void
  onDiscardAccess: () => void
  onDiscardDraft: () => void
  onRetry: () => void
}

export function WorkspaceStatusCard({
  access,
  agentAccessUrl,
  canMutate,
  discardLabel,
  safety,
  view,
  onCreateAccess,
  onDiscardAccess,
  onDiscardDraft,
  onRetry,
}: WorkspaceStatusCardProps) {
  const isAvailable = access.status === 'available' && agentAccessUrl !== null
  const changeCount = safety.status === 'ahead-of-version' ? safety.changeCount : 0

  return (
    <section className="workspace-card workspace-status-card" aria-labelledby="workspace-status-heading">
      <h2 id="workspace-status-heading">
        <WorkspaceActivityIndicator status={view.status} changeCount={changeCount} />
      </h2>
      <div className="workspace-status-meta">
        <span>{safetyLabel(safety)}</span>
        <span>{accessLabel(access, agentAccessUrl !== null)}</span>
      </div>
      {(view.status === 'offline' || view.status === 'request-error') && (
        <button className="ui-button" type="button" onClick={onRetry}>Retry connection</button>
      )}
      <div className="workspace-status-actions">
        {isAvailable ? (
          <button className="workspace-secondary-link" type="button" disabled={!canMutate} onClick={onDiscardAccess}>
            End agent access
          </button>
        ) : (
          <button
            className="ui-button"
            type="button"
            disabled={!canMutate || access.status === 'creating'}
            onClick={onCreateAccess}
          >
            {access.status === 'not-created' ? 'Create agent access' : 'Create new link'}
          </button>
        )}
        <button
          className="workspace-danger-link"
          type="button"
          disabled={!canMutate}
          onClick={onDiscardDraft}
        >
          {discardLabel}
        </button>
      </div>
    </section>
  )
}
