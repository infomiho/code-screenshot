import { AccountMenu } from '../account-menu'
import type { AmbientAccountDto } from './contracts'

type AmbientWorkspaceHeaderProps = {
  account: AmbientAccountDto
  draftCount: number
  versionInUse: number | null
  onClose: () => void
  onSignOut: () => void
}

export function AmbientWorkspaceHeader({
  account,
  draftCount,
  versionInUse,
  onClose,
  onSignOut,
}: AmbientWorkspaceHeaderProps) {
  return (
    <header className="subpage-header">
      <button className="subpage-back-button" type="button" aria-label="Your ambients" onClick={onClose}>
        <span className="subpage-back-arrow" aria-hidden="true">←</span>
        <span className="subpage-back-label">Your ambients</span>
      </button>
      <div className="subpage-header-end">
        {versionInUse !== null && (
          <div className="subpage-header-meta" aria-label="Version in use">
            Version {versionInUse} in use
          </div>
        )}
        {account.kind === 'signed-in' && (
          <AccountMenu
            username={account.username}
            draftCount={draftCount}
            onOpenLibrary={onClose}
            onSignOut={onSignOut}
          />
        )}
      </div>
    </header>
  )
}
