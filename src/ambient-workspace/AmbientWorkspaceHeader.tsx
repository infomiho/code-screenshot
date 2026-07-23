import { AccountMenu } from '../account-menu'
import type { AmbientAccountDto } from './contracts'
import type { AmbientLinkSharingDto } from './contracts'
import { AmbientSharePopover } from './AmbientSharePopover'

type AmbientWorkspaceHeaderProps = {
  account: AmbientAccountDto
  draftCount: number
  versionInUse: number | null
  linkSharing?: AmbientLinkSharingDto
  slug?: string
  onClose: () => void
  onSignOut: () => void
  onSharingChange?: (enabled: boolean) => Promise<boolean>
}

export function AmbientWorkspaceHeader({
  account,
  draftCount,
  versionInUse,
  linkSharing,
  slug,
  onClose,
  onSignOut,
  onSharingChange,
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
        {linkSharing && slug && onSharingChange && (
          <AmbientSharePopover
            linkSharing={linkSharing}
            slug={slug}
            versionInUse={versionInUse}
            onSharingChange={onSharingChange}
          />
        )}
        {account.kind === 'signed-in' && (
          <AccountMenu
            username={account.username}
            avatarUrl={account.avatarUrl}
            draftCount={draftCount}
            onOpenLibrary={onClose}
            onSignOut={onSignOut}
          />
        )}
      </div>
    </header>
  )
}
