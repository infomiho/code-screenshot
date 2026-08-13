import type { ReactNode } from 'react'
import { Menu } from '@base-ui/react/menu'
import { Popover } from '@base-ui/react/popover'
import { IconDots, IconX } from '@tabler/icons-react'
import { AmbientMark } from '../rendering/ambient-mark'
import type { AmbientDefinition } from '../rendering/ambient-themes'
import type { OwnedAmbientSummary } from '../management/ambient-workspace-service'
import './ambient-actions-menu.css'

export type AmbientAction = {
  id: string
  label: ReactNode
  danger?: boolean
  onSelect: () => void
}

type AmbientIdentity = {
  definition: AmbientDefinition | null
  name: string
  meta: string
}

export function AmbientActionsMenu({
  actions,
  identity,
  triggerLabel,
}: {
  actions: readonly AmbientAction[]
  identity: AmbientIdentity
  triggerLabel: string
}) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger className="ui-button ui-button-icon ambient-actions-trigger" aria-label={triggerLabel}>
        <IconDots aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="ambient-actions-positioner" align="end" sideOffset={8} collisionPadding={12}>
          <Menu.Popup className="ambient-actions-popup">
            <div className="ambient-actions-context">
              {identity.definition
                ? <AmbientMark definition={identity.definition} />
                : <span className="ambient-actions-placeholder-mark" aria-hidden="true" />}
              <span className="ambient-actions-identity">
                <strong>{identity.name}</strong>
                <span>{identity.meta}</span>
              </span>
            </div>
            {actions.map((action) => (
              <Menu.Item
                className="ambient-actions-item"
                data-danger={action.danger || undefined}
                key={action.id}
                onClick={action.onSelect}
              >
                {action.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

export function OwnedAmbientActions({
  ambient,
  definition,
  onCopyLink,
  onEdit,
}: {
  ambient: OwnedAmbientSummary
  definition: AmbientDefinition
  onCopyLink: (ambient: OwnedAmbientSummary) => void
  onEdit: (ambientId: string) => void
}) {
  const actions: AmbientAction[] = [
    { id: 'edit', label: 'Edit theme', onSelect: () => onEdit(ambient.id) },
  ]
  if (ambient.visibility === 'link' && ambient.shareId) {
    actions.push({
      id: 'copy-link',
      label: 'Copy sharing link',
      onSelect: () => onCopyLink(ambient),
    })
  }

  return (
    <AmbientActionsMenu
      triggerLabel={`More actions for ${ambient.name}`}
      identity={{
        definition,
        name: ambient.name,
        meta: `Your theme · ${ambient.visibility === 'link' ? 'Shared' : 'Private'} · Version ${ambient.currentVersion?.version ?? 1}`,
      }}
      actions={actions}
    />
  )
}

export type AmbientToolbarActionState =
  | { kind: 'none' }
  | {
      kind: 'owned'
      ambient: OwnedAmbientSummary
      onCopyLink: (ambient: OwnedAmbientSummary) => void
      onEdit: (ambientId: string) => void
    }
  | { kind: 'shared'; isCopying: boolean; onCopy: () => void }

export function AmbientToolbarActions({
  definition,
  state,
}: {
  definition: AmbientDefinition
  state: AmbientToolbarActionState
}) {
  if (state.kind === 'shared') {
    return (
      <SharedAmbientActions
        definition={definition}
        isCopying={state.isCopying}
        onCopy={state.onCopy}
      />
    )
  }
  if (state.kind === 'owned') {
    return (
      <OwnedAmbientActions
        ambient={state.ambient}
        definition={definition}
        onCopyLink={state.onCopyLink}
        onEdit={state.onEdit}
      />
    )
  }
  return null
}

export function SharedAmbientActions({
  definition,
  isCopying,
  onCopy,
}: {
  definition: AmbientDefinition
  isCopying: boolean
  onCopy: () => void
}) {
  const headingId = 'shared-ambient-copy-heading'

  return (
    <Popover.Root>
      <Popover.Trigger
        render={(
          <button className="ui-button ui-button-icon ambient-actions-trigger" type="button" aria-label={`More actions for ${definition.manifest.name}`}>
            <IconDots aria-hidden="true" />
          </button>
        )}
      />
      <Popover.Portal>
        <Popover.Positioner className="ambient-actions-positioner" align="end" sideOffset={8} collisionPadding={12}>
          <Popover.Popup className="ambient-actions-popup ambient-copy-popup" aria-labelledby={headingId}>
            <div className="ambient-copy-heading">
              <h2 id={headingId}>Copy theme</h2>
              <Popover.Close className="ambient-actions-close" aria-label="Close copy theme panel">
                <IconX aria-hidden="true" />
              </Popover.Close>
            </div>
            <p>Add this theme to your account and customize it.</p>
            <button className="ui-button ui-button-primary ambient-copy-action" type="button" disabled={isCopying} onClick={onCopy}>
              {isCopying ? 'Copying...' : 'Copy theme'}
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
