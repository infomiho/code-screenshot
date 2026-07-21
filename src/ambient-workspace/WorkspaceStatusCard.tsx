import type {
  AgentAccessView,
  AmbientWorkspaceView,
  DraftSafetyView,
} from './agent-workflow-machine'
import { WorkspaceActivityIndicator } from './WorkspaceActivityIndicator'

const formatExpiry = (expiresAt: string) => new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
}).format(new Date(expiresAt))

const formatChanges = (changeCount: number) =>
  `${changeCount} ${changeCount === 1 ? 'change' : 'changes'}`

// The header shows the version in use, the heading carries the draft state,
// and the Versions tab counts saves, so meta facts only cover the rest.
const safetyLabel = (safety: DraftSafetyView) => {
  if (safety.status === 'different-from-version') return `Differs from Version ${safety.version}`
  if (safety.status === 'based-on-version') {
    return `From Version ${safety.sourceVersion} · ${formatChanges(safety.changeCount)}`
  }
  if (safety.status === 'ahead-of-version') {
    return `${formatChanges(safety.changeCount)} ahead of Version ${safety.version}`
  }
  return null
}

const accessLabel = (access: AgentAccessView, hasAccessUrl: boolean) => {
  if (access.status === 'available' && hasAccessUrl) return `Access until ${formatExpiry(access.expiresAt)}`
  if (access.status === 'creating') return 'Creating access...'
  if (access.status === 'expired') return 'Access ended'
  if (access.status === 'available' || access.status === 'unavailable') return 'New access required'
  return null
}

type WorkspaceStatusCardProps = {
  access: AgentAccessView
  agentAccessUrl: string | null
  canMutate: boolean
  discardLabel: string
  hasWorkingDraft: boolean
  safety: DraftSafetyView
  versionInUse: number | null
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
  hasWorkingDraft,
  safety,
  versionInUse,
  view,
  onCreateAccess,
  onDiscardAccess,
  onDiscardDraft,
  onRetry,
}: WorkspaceStatusCardProps) {
  if (!hasWorkingDraft && versionInUse !== null) {
    return (
      <section className="workspace-card workspace-status-card" aria-labelledby="workspace-status-heading">
        <h2 id="workspace-status-heading">No active draft</h2>
        <div className="workspace-status-actions">
          <button
            className="ui-button ui-button-primary"
            type="button"
            disabled={!canMutate || access.status === 'creating'}
            onClick={onCreateAccess}
          >
            {access.status === 'creating' ? 'Starting...' : 'Start editing'}
          </button>
        </div>
      </section>
    )
  }

  const isAvailable = access.status === 'available' && agentAccessUrl !== null
  const changeCount = safety.status === 'ahead-of-version' ? safety.changeCount : 0
  const facts = [safetyLabel(safety), accessLabel(access, agentAccessUrl !== null)]
    .filter((fact): fact is string => fact !== null)

  return (
    <section className="workspace-card workspace-status-card" aria-labelledby="workspace-status-heading">
      <h2 id="workspace-status-heading">
        <WorkspaceActivityIndicator status={view.status} changeCount={changeCount} />
      </h2>
      {facts.length > 0 && (
        <div className="workspace-status-meta">
          {facts.map((fact) => <span key={fact}>{fact}</span>)}
        </div>
      )}
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
