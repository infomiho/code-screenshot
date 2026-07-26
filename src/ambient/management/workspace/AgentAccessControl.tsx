import type { AgentAccessView } from '../agent/agent-workflow-machine'

export const formatAgentAccessExpiry = (expiresAt: string) => new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
}).format(new Date(expiresAt))

export function AgentAccessControl({
  access,
  canMutate,
  hasAccessUrl,
  onEndAccess,
}: {
  access: AgentAccessView
  canMutate: boolean
  hasAccessUrl: boolean
  onEndAccess: () => void
}) {
  if (access.status !== 'available' || !hasAccessUrl) return null

  return (
    <section className="workspace-access-control" aria-labelledby="workspace-access-heading">
      <span className="workspace-access-copy">
        <strong id="workspace-access-heading">Agent access</strong>
        <span>Active until {formatAgentAccessExpiry(access.expiresAt)}</span>
      </span>
      <button className="workspace-secondary-link" type="button" disabled={!canMutate} onClick={onEndAccess}>
        End access
      </button>
    </section>
  )
}
