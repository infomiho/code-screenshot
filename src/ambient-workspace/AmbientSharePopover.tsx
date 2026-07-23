import { useId, useRef, useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import { IconLink, IconLock, IconX } from '@tabler/icons-react'
import type { AmbientLinkSharingDto } from './contracts'
import { toastManager } from '../toast'
import './ambient-share-popover.css'

type AmbientSharePopoverProps = {
  linkSharing: AmbientLinkSharingDto
  slug: string
  versionInUse: number | null
  onSharingChange: (enabled: boolean) => Promise<boolean>
}

function AccessIcon({ enabled }: { enabled: boolean }) {
  const Icon = enabled ? IconLink : IconLock
  return <Icon aria-hidden="true" stroke={1.75} />
}

export function AmbientSharePopover({
  linkSharing,
  slug,
  versionInUse,
  onSharingChange,
}: AmbientSharePopoverProps) {
  const headingId = `${useId()}-share-heading`
  const [isUpdating, setIsUpdating] = useState(false)
  const enableButtonRef = useRef<HTMLButtonElement>(null)
  const copyButtonRef = useRef<HTMLButtonElement>(null)
  const shareUrl = linkSharing.shareId
    ? `${globalThis.location.origin}/a/${encodeURIComponent(linkSharing.shareId)}/${encodeURIComponent(slug)}`
    : null

  const updateSharing = async (enabled: boolean) => {
    setIsUpdating(true)
    const updated = await onSharingChange(enabled)
    setIsUpdating(false)
    toastManager.add({
      description: updated
        ? enabled ? 'Link sharing enabled.' : 'Link sharing turned off.'
        : enabled ? 'Could not enable link sharing.' : 'Could not turn off link sharing.',
      priority: updated ? 'low' : 'high',
    })
    if (updated) {
      requestAnimationFrame(() => {
        if (enabled) copyButtonRef.current?.focus()
        else enableButtonRef.current?.focus()
      })
    }
  }

  const copyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      toastManager.add({ description: 'Share link copied.' })
    } catch {
      toastManager.add({ description: 'Could not copy the share link.', priority: 'high' })
    }
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        render={(
          <button
            className="ambient-share-trigger"
            type="button"
            aria-label={linkSharing.enabled ? 'Shared ambient' : 'Share ambient'}
            data-enabled={linkSharing.enabled || undefined}
          >
            <span className="ambient-share-trigger-icon"><AccessIcon enabled={linkSharing.enabled} /></span>
            <span>{linkSharing.enabled ? 'Shared' : 'Share'}</span>
          </button>
        )}
      />
      <Popover.Portal>
        <Popover.Positioner className="ambient-share-positioner" side="bottom" align="end" sideOffset={8} collisionPadding={12}>
          <Popover.Popup className="ambient-share-popup" aria-labelledby={headingId}>
            <div className="ambient-share-heading">
              <h2 id={headingId}>Share ambient</h2>
              <Popover.Close className="ambient-share-close" aria-label="Close share panel">
                <IconX aria-hidden="true" />
              </Popover.Close>
            </div>

            <section className="ambient-share-access" aria-labelledby="ambient-share-access-heading">
              <h3 id="ambient-share-access-heading">General access</h3>
              <div className="ambient-share-access-row">
                <span className="ambient-share-access-icon" data-enabled={linkSharing.enabled || undefined}>
                  <AccessIcon enabled={linkSharing.enabled} />
                </span>
                <span className="ambient-share-access-copy">
                  <strong>{linkSharing.enabled ? 'Anyone with the link' : 'Private'}</strong>
                  <span>
                    {linkSharing.enabled
                      ? 'Can use the latest saved version'
                      : 'Only you can access this ambient'}
                  </span>
                </span>
              </div>
              {!linkSharing.enabled && versionInUse === null && (
                <p className="ambient-share-version">Save a version before sharing this ambient.</p>
              )}
            </section>

            <div className="ambient-share-footer">
              {linkSharing.enabled ? (
                <>
                  <button
                    className="ambient-share-disable"
                    type="button"
                    disabled={isUpdating}
                    onClick={() => void updateSharing(false)}
                  >
                    {isUpdating ? 'Turning off…' : 'Turn off link sharing'}
                  </button>
                  <button
                    ref={copyButtonRef}
                    className="ui-button ui-button-primary ambient-share-copy"
                    type="button"
                    disabled={isUpdating}
                    onClick={() => void copyLink()}
                  >
                    <AccessIcon enabled />
                    Copy link
                  </button>
                </>
              ) : (
                <button
                  ref={enableButtonRef}
                  className="ui-button ui-button-primary ambient-share-enable"
                  type="button"
                  disabled={versionInUse === null || isUpdating}
                  onClick={() => void updateSharing(true)}
                >
                  {isUpdating ? 'Enabling…' : 'Enable link sharing'}
                </button>
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
