import { useEffect, useRef } from 'react'
import type { AmbientAccount } from './ambient-workspace/ambient-workspace-service'
import './site-header.css'

type SiteHeaderProps = {
  account: AmbientAccount
  onSignIn: () => void
  onSignOut: () => void
}

const getAvatarInitial = (username: string) => username.trim().charAt(0).toLocaleUpperCase() || '?'

export function SiteHeader({ account, onSignIn, onSignOut }: SiteHeaderProps) {
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
      <nav className="site-account" aria-label="Account">
        {account.kind === 'signed-out' ? (
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
              <span>Signed in as</span>
              <strong>@{account.username}</strong>
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
