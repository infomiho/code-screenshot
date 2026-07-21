import { useEffect, useRef } from 'react'
import './account-menu.css'

type AccountMenuProps = {
  username: string
  avatarUrl?: string | null
  draftCount?: number
  onOpenLibrary?: () => void
  onSignOut: () => void
}

const getAvatarInitial = (username: string) => username.trim().charAt(0).toLocaleUpperCase() || '?'

const formatLibraryLabel = (draftCount: number) =>
  draftCount > 0 ? `Your ambients (${draftCount} draft${draftCount === 1 ? '' : 's'})` : 'Your ambients'

export function AccountMenu({ username, avatarUrl = null, draftCount = 0, onOpenLibrary, onSignOut }: AccountMenuProps) {
  const menuRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        menuRef.current?.removeAttribute('open')
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !menuRef.current?.open) return
      event.preventDefault()
      menuRef.current.removeAttribute('open')
      menuRef.current.querySelector<HTMLElement>('summary')?.focus()
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  return (
    <details className="account-menu" ref={menuRef}>
      <summary>
        <span className="account-avatar" aria-hidden="true">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : getAvatarInitial(username)}
        </span>
        <span className="account-username">@{username}</span>
        <span className="account-disclosure" aria-hidden="true" />
      </summary>
      <div className="account-menu-content">
        {onOpenLibrary && (
          <button
            className="account-menu-link"
            type="button"
            onClick={() => {
              menuRef.current?.removeAttribute('open')
              onOpenLibrary()
            }}
          >
            {formatLibraryLabel(draftCount)}
          </button>
        )}
        <button className="ui-button account-menu-action" type="button" onClick={onSignOut}>
          Log out
        </button>
      </div>
    </details>
  )
}
