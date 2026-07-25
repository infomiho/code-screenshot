import { AccountMenu } from './account/account-menu'
import type { AmbientAccountDto } from './ambient/management/contracts'
import './site-header.css'

type SiteHeaderProps = {
  account: AmbientAccountDto
  isHydrated: boolean
  draftCount: number
  isCreatingTheme: boolean
  onCreateTheme: () => void
  onOpenLibrary: () => void
  onOpenAdmin: () => void
  onSignIn: () => void
  onSignOut: () => void
}

export function SiteHeader({
  account,
  isHydrated,
  draftCount,
  isCreatingTheme,
  onCreateTheme,
  onOpenLibrary,
  onOpenAdmin,
  onSignIn,
  onSignOut,
}: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-brand">codeshot.dev</div>
      <nav className="site-account" aria-label="Account" aria-busy={!isHydrated}>
        <button
          className="ui-button ui-button-primary ui-button-signal site-create-theme"
          type="button"
          disabled={isCreatingTheme}
          onClick={onCreateTheme}
        >
          {isCreatingTheme ? 'Opening...' : 'Create your theme'}
        </button>
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
