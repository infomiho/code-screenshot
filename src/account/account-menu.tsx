import { Menu } from '@base-ui/react/menu'
import './account-menu.css'

type AccountMenuProps = {
  username: string
  avatarUrl?: string | null
  draftCount?: number
  onOpenLibrary?: () => void
  onOpenAdmin?: () => void
  onSignOut: () => void
}

const getAvatarInitial = (username: string) => username.trim().charAt(0).toLocaleUpperCase() || '?'

const formatLibraryLabel = (draftCount: number) =>
  draftCount > 0 ? `Your ambients (${draftCount} draft${draftCount === 1 ? '' : 's'})` : 'Your ambients'

export function AccountMenu({
  username,
  avatarUrl = null,
  draftCount = 0,
  onOpenLibrary,
  onOpenAdmin,
  onSignOut,
}: AccountMenuProps) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger className="account-menu-trigger">
        <span className="account-avatar" aria-hidden="true">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : getAvatarInitial(username)}
        </span>
        <span className="account-username">@{username}</span>
        <span className="account-disclosure" aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="account-menu-positioner" align="end" sideOffset={6}>
          <Menu.Popup className="account-menu-content">
            {onOpenLibrary && (
              <>
                <Menu.Item className="account-menu-item" onClick={onOpenLibrary}>
                  {formatLibraryLabel(draftCount)}
                </Menu.Item>
                <Menu.Separator className="account-menu-separator" />
              </>
            )}
            {onOpenAdmin && (
              <>
                <Menu.Item className="account-menu-item" onClick={onOpenAdmin}>
                  Admin
                </Menu.Item>
                <Menu.Separator className="account-menu-separator" />
              </>
            )}
            <Menu.Item className="account-menu-item" onClick={onSignOut}>
              Log out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
