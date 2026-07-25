import { AccountMenu } from '../../../account/account-menu'
import type { AmbientAccountDto, AmbientOwnership } from '../contracts'
import type { AmbientLinkSharingDto } from '../contracts'
import { AmbientSharePopover } from '../sharing/AmbientSharePopover'
import { AmbientNameField } from './AmbientNameField'

type AmbientWorkspaceHeaderProps = {
  account: AmbientAccountDto
  draftCount: number
  hasSavedVersion?: boolean
  hasUnsavedChanges?: boolean
  linkSharing?: AmbientLinkSharingDto
  name?: string
  ownership: AmbientOwnership
  slug?: string
  versionInUse?: number | null
  onClose: () => void
  onOpenAdmin?: () => void
  onRename?: (name: string) => Promise<boolean>
  onSignIn?: () => void
  onSignOut: () => void
  onSharingChange?: (enabled: boolean) => Promise<boolean>
}

// A guest has no library to go back to, so the exit leads to the editor instead.
const backLabel = (ownership: AmbientOwnership) =>
  ownership === 'guest' ? 'codeshot.dev' : 'Your themes'

export function AmbientWorkspaceHeader({
  account,
  draftCount,
  hasSavedVersion,
  hasUnsavedChanges,
  linkSharing,
  name,
  ownership,
  slug,
  versionInUse,
  onClose,
  onOpenAdmin,
  onRename,
  onSignIn,
  onSignOut,
  onSharingChange,
}: AmbientWorkspaceHeaderProps) {
  const isGuest = ownership === 'guest'
  return (
    <header className="subpage-header">
      <button className="subpage-back-button" type="button" aria-label={backLabel(ownership)} onClick={onClose}>
        <span className="subpage-back-arrow" aria-hidden="true">←</span>
        <span className="subpage-back-label">{backLabel(ownership)}</span>
      </button>
      {name && onRename && (
        <div className="subpage-header-title">
          <AmbientNameField name={name} onRename={onRename} />
          {isGuest ? (
            <span className="workspace-unsaved-chip">Not saved</span>
          ) : hasUnsavedChanges ? (
            <span className="workspace-unsaved-chip">
              {versionInUse === null ? 'Unsaved' : 'Unsaved changes'}
            </span>
          ) : null}
        </div>
      )}
      <div className="subpage-header-end">
        {!isGuest && linkSharing && slug && onSharingChange && (
          <AmbientSharePopover
            hasSavedVersion={Boolean(hasSavedVersion)}
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
