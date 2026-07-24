import { AccountMenu } from '../../../account/account-menu'
import type { AmbientAccountDto } from '../contracts'
import type { AmbientLinkSharingDto } from '../contracts'
import { AmbientSharePopover } from '../sharing/AmbientSharePopover'

type AmbientWorkspaceHeaderProps = {
  account: AmbientAccountDto
  draftCount: number
  hasSavedVersion?: boolean
  linkSharing?: AmbientLinkSharingDto
  slug?: string
  onClose: () => void
  onOpenAdmin?: () => void
  onSignOut: () => void
  onSharingChange?: (enabled: boolean) => Promise<boolean>
}

export function AmbientWorkspaceHeader({
  account,
  draftCount,
  hasSavedVersion,
  linkSharing,
  slug,
  onClose,
  onOpenAdmin,
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
        {linkSharing && slug && onSharingChange && (
          <AmbientSharePopover
            hasSavedVersion={Boolean(hasSavedVersion)}
            linkSharing={linkSharing}
            slug={slug}
            onSharingChange={onSharingChange}
          />
        )}
        {account.kind === 'signed-in' && (
          <AccountMenu
            username={account.username}
            avatarUrl={account.avatarUrl}
            draftCount={draftCount}
            onOpenLibrary={onClose}
            onOpenAdmin={account.isAdmin ? onOpenAdmin : undefined}
            onSignOut={onSignOut}
          />
        )}
      </div>
    </header>
  )
}
