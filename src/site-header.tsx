import { useEffect, useRef } from 'react'
import type { AmbientAccountDto } from './ambient-workspace/contracts'
import './site-header.css'

type SiteHeaderProps = {
  account: AmbientAccountDto
  isHydrated: boolean
  draftCount: number
  onOpenLibrary: () => void
  onSignIn: () => void
  onSignOut: () => void
}

const getAvatarInitial = (username: string) => username.trim().charAt(0).toLocaleUpperCase() || '?'

export function SiteHeader({
  account,
  isHydrated,
  draftCount,
  onOpenLibrary,
  onSignIn,
  onSignOut,
}: SiteHeaderProps) {
  const accountMenuRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    if (account.kind !== 'signed-in') return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        accountMenuRef.current?.removeAttribute('open')
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !accountMenuRef.current?.open) return
      event.preventDefault()
      accountMenuRef.current.removeAttribute('open')
      accountMenuRef.current.querySelector<HTMLElement>('summary')?.focus()
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [account.kind])

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
          <details className="account-menu" ref={accountMenuRef}>
            <summary>
              <span className="account-avatar" aria-hidden="true">{getAvatarInitial(account.username)}</span>
              <span className="account-username">@{account.username}</span>
              <span className="account-disclosure" aria-hidden="true" />
            </summary>
            <div className="account-menu-content">
              <button
                className="account-menu-link"
                type="button"
                onClick={() => {
                  accountMenuRef.current?.removeAttribute('open')
                  onOpenLibrary()
                }}
              >
                Your ambients{draftCount > 0 ? ` (${draftCount} draft${draftCount === 1 ? '' : 's'})` : ''}
              </button>
              <button className="ui-button account-menu-action" type="button" onClick={onSignOut}>
                Log out
              </button>
            </div>
          </details>
        )}
      </nav>
    </header>
  )
}
