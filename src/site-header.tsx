import { AccountMenu } from './account/account-menu'
import type { AmbientAccountDto } from './ambient/management/contracts'
import './site-header.css'

type SiteHeaderProps = {
  account: AmbientAccountDto
  isHydrated: boolean
  draftCount: number
  onOpenLibrary: () => void
  onSignIn: () => void
  onSignOut: () => void
}

export function SiteHeader({
  account,
  isHydrated,
  draftCount,
  onOpenLibrary,
  onSignIn,
  onSignOut,
}: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-brand">codeshot.dev</div>
      <nav className="site-account" aria-label="Account" aria-busy={!isHydrated}>
        {!isHydrated ? (
          <div className="account-skeleton" aria-hidden="true">
            <span className="skeleton-circle account-skeleton-avatar" />
            <span className="skeleton account-skeleton-name" />
          </div>
        ) : account.kind === 'signed-out' ? (
          <button className="ui-button" type="button" onClick={onSignIn}>
            Sign in with GitHub
          </button>
        ) : (
          <AccountMenu
            username={account.username}
            avatarUrl={account.avatarUrl}
            draftCount={draftCount}
            onOpenLibrary={onOpenLibrary}
            onSignOut={onSignOut}
          />
        )}
      </nav>
    </header>
  )
}
