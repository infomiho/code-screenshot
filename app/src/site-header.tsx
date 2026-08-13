import { AccountMenu } from './account/account-menu'
import type { AmbientAccountDto } from './ambient/management/contracts'
import './site-header.css'

type SiteHeaderProps = {
  account: AmbientAccountDto
  isHydrated: boolean
  draftCount: number
  onOpenLibrary: () => void
  onOpenAdmin: () => void
  onSignIn: () => void
  onSignOut: () => void
}

export function SiteHeader({
  account,
  isHydrated,
  draftCount,
  onOpenLibrary,
  onOpenAdmin,
  onSignIn,
  onSignOut,
}: SiteHeaderProps) {
  return (
    <header className="site-header">
      <a className="site-brand" href="/">codeshot.dev</a>
      <nav className="site-account" aria-label="Account" aria-busy={!isHydrated}>
        {!isHydrated ? (
          <div className="account-skeleton" aria-hidden="true">
            <span className="skeleton-circle account-skeleton-avatar" />
            <span className="skeleton account-skeleton-name" />
          </div>
        ) : account.kind === 'signed-out' ? (
          <button className="ui-button ui-button-ghost site-sign-in" type="button" onClick={onSignIn}>
            Sign in
          </button>
        ) : (
          <AccountMenu
            username={account.username}
            avatarUrl={account.avatarUrl}
            draftCount={draftCount}
            onOpenLibrary={onOpenLibrary}
            onOpenAdmin={account.isAdmin ? onOpenAdmin : undefined}
            onSignOut={onSignOut}
          />
        )}
      </nav>
    </header>
  )
}
