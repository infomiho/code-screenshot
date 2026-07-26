import { AccountMenu } from '../../../account/account-menu'
import type { AmbientAccountDto, AmbientLinkSharingDto, AmbientOwnership } from '../contracts'
import { AmbientSharePopover } from '../sharing/AmbientSharePopover'

type AmbientWorkspaceHeaderProps = {
  account: AmbientAccountDto
  draftCount: number
  hasSavedVersion: boolean
  linkSharing?: AmbientLinkSharingDto
  ownership: AmbientOwnership
  slug?: string
  onClose: () => void
  onOpenAdmin?: () => void
  onSignIn?: () => void
  onSignOut: () => void
  onSharingChange?: (enabled: boolean) => Promise<boolean>
}

const backLabel = (ownership: AmbientOwnership) =>
  ownership === 'guest' ? 'codeshot.dev' : 'Your themes'

export function AmbientWorkspaceHeader({
  account,
  draftCount,
  hasSavedVersion,
  linkSharing,
  ownership,
  slug,
  onClose,
  onOpenAdmin,
  onSignIn,
  onSignOut,
  onSharingChange,
}: AmbientWorkspaceHeaderProps) {
  return (
    <header className="subpage-header">
      <button className="subpage-back-button" type="button" aria-label={backLabel(ownership)} onClick={onClose}>
        <span className="subpage-back-arrow" aria-hidden="true">←</span>
        <span className="subpage-back-label">{backLabel(ownership)}</span>
      </button>
      <div className="subpage-header-end">
        {hasSavedVersion && linkSharing && slug && onSharingChange && (
          <AmbientSharePopover
            hasSavedVersion={hasSavedVersion}
            linkSharing={linkSharing}
            slug={slug}
            onSharingChange={onSharingChange}
          />
        )}
        {account.kind === 'signed-in' ? (
          <AccountMenu
            username={account.username}
            avatarUrl={account.avatarUrl}
            draftCount={draftCount}
            onOpenLibrary={onClose}
            onOpenAdmin={account.isAdmin ? onOpenAdmin : undefined}
            onSignOut={onSignOut}
          />
        ) : onSignIn ? (
          <button className="ui-button ui-button-ghost site-sign-in" type="button" onClick={onSignIn}>
            Sign in
          </button>
        ) : null}
      </div>
    </header>
  )
}
