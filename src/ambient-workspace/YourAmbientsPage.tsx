import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { AccountMenu } from '../account-menu'
import { AmbientMark } from '../ambient-mark'
import { Toaster, toastManager } from '../toast'
import { ConfirmDialog } from '../confirm-dialog'
import type { AmbientDefinition } from '../ambient-themes'
import { countDraftAmbients, type AmbientWorkspaceService, type OwnedAmbientSummary } from './ambient-workspace-service'
import { useAmbientWorkspace } from './use-ambient-workspace'
import '../index.css'
import './your-ambients-page.css'

type YourAmbientsPageProps = {
  ambientWorkspaceService?: AmbientWorkspaceService
  onOpenEditor?: () => void
  onOpenWorkspace?: (ambientId: string) => void
}

const draftStatusLabel = {
  waiting: 'Working draft',
  'review-ready': 'Ready to review',
  'matches-version': 'Draft synced',
} as const

function DeleteAmbientDialog({
  ambient,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  ambient: OwnedAmbientSummary
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const description = ambient.currentVersion
    ? `This permanently removes ${ambient.name}, all ${ambient.currentVersion.version === 1 ? 'its saved history' : `${ambient.currentVersion.version} versions`}, and any working draft. Screenshots already exported are not affected.`
    : `This permanently removes ${ambient.name} and its working draft.`

  return (
    <ConfirmDialog
      confirmLabel={isDeleting ? 'Deleting...' : 'Delete ambient'}
      description={description}
      eyebrow="Permanent action"
      isBusy={isDeleting}
      isDanger
      isOpen
      title={`Delete ${ambient.name}?`}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}

function EmptyLibrary({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="ambient-library-empty-state">
      <div className="ambient-library-empty-stage" aria-hidden="true">
        <span className="ambient-library-ghost-mark" />
        <span className="ambient-library-ghost-mark" />
        <span className="ambient-library-ghost-mark" />
      </div>
      <h2>No ambients yet</h2>
      <p>
        An ambient is a reusable visual frame for your code screenshots.
        Describe the look you want and build it with help from your coding agent.
      </p>
      <button className="ui-button ui-button-primary" type="button" onClick={onCreate}>
        Create your first ambient
      </button>
    </div>
  )
}

export function YourAmbientsPage({
  ambientWorkspaceService,
  onOpenEditor,
  onOpenWorkspace,
}: YourAmbientsPageProps = {}) {
  const navigate = useNavigate()
  const { definitions, draftDefinitions, service, snapshot } = useAmbientWorkspace(ambientWorkspaceService)
  const [pendingDelete, setPendingDelete] = useState<OwnedAmbientSummary | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    document.title = 'Your ambients | codeshot.dev'
  }, [])

  const openEditor = () => {
    if (onOpenEditor) {
      onOpenEditor()
    } else {
      navigate('/')
    }
  }

  const openWorkspace = (ambientId: string) => {
    if (onOpenWorkspace) {
      onOpenWorkspace(ambientId)
    } else {
      navigate(`/ambients/${encodeURIComponent(ambientId)}`)
    }
  }

  const signOut = async () => {
    await service.signOut()
    openEditor()
  }

  const deleteAmbient = async () => {
    if (!pendingDelete) return
    setIsDeleting(true)
    const deleted = await service.deleteAmbient(pendingDelete.id)
    setIsDeleting(false)
    toastManager.add({
      description: deleted ? `${pendingDelete.name} deleted.` : `Could not delete ${pendingDelete.name}.`,
      priority: deleted ? 'low' : 'high',
    })
    if (deleted) setPendingDelete(null)
  }

  const getRowDefinition = (ambient: OwnedAmbientSummary): AmbientDefinition | null =>
    definitions.find((definition) => definition.id === ambient.id)
    ?? draftDefinitions.get(ambient.id)
    ?? null

  const renderLibrary = () => {
    if (!snapshot.isHydrated) {
      return (
        <ul className="ambient-library-list" aria-hidden="true">
          {[0, 1].map((row) => (
            <li className="ambient-library-row" key={row}>
              <div className="ambient-library-row-open">
                <span className="skeleton ambient-library-skeleton-mark" />
                <div className="ambient-library-row-copy">
                  <span className="skeleton ambient-library-skeleton-name" />
                  <span className="skeleton ambient-library-skeleton-meta" />
                </div>
              </div>
              <div className="ambient-library-row-actions">
                <span className="skeleton ambient-library-skeleton-edit" />
                <span className="skeleton ambient-library-skeleton-delete" />
              </div>
            </li>
          ))}
        </ul>
      )
    }

    if (snapshot.account.kind !== 'signed-in') {
      return (
        <div className="ambient-library-empty-state">
          <h2>Sign in to manage your ambients</h2>
          <p>Your ambients are private to your GitHub account.</p>
          <button className="ui-button ui-button-primary" type="button" onClick={service.signIn}>
            Sign in with GitHub
          </button>
        </div>
      )
    }

    if (snapshot.ownedAmbients.length === 0) {
      return <EmptyLibrary onCreate={() => openWorkspace('new')} />
    }

    return (
      <ul className="ambient-library-list">
        {snapshot.ownedAmbients.map((ambient) => {
          const definition = getRowDefinition(ambient)
          return (
            <li className="ambient-library-row" key={ambient.id}>
              <button className="ambient-library-row-open" type="button" onClick={() => openWorkspace(ambient.id)}>
                {definition
                  ? <AmbientMark definition={definition} />
                  : <span className="ambient-library-placeholder-mark" aria-hidden="true" />}
                <div className="ambient-library-row-copy">
                  <strong>{ambient.name}</strong>
                  <span className="ambient-library-row-meta">
                    <span>{ambient.currentVersion ? `Version ${ambient.currentVersion.version}` : 'Not saved yet'}</span>
                    <span aria-hidden="true">·</span>
                    <span data-visibility={ambient.visibility}>
                      {ambient.visibility === 'link' ? 'Shared' : 'Private'}
                    </span>
                    {ambient.draft && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span data-status={ambient.draft.status}>{draftStatusLabel[ambient.draft.status]}</span>
                      </>
                    )}
                  </span>
                </div>
              </button>
              <div className="ambient-library-row-actions">
                <button className="ui-button" type="button" onClick={() => openWorkspace(ambient.id)}>
                  Edit
                </button>
                <button
                  className="ambient-library-delete-button"
                  type="button"
                  onClick={() => setPendingDelete(ambient)}
                >
                  Delete
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    )
  }

  const account = snapshot.isHydrated && snapshot.account.kind === 'signed-in' ? snapshot.account : null

  return (
    <main className="ambient-library-page" aria-busy={!snapshot.isHydrated}>
      <header className="subpage-header">
        <button className="subpage-back-button" type="button" aria-label="Back to editor" onClick={openEditor}>
          <span className="subpage-back-arrow" aria-hidden="true">←</span>
          <span className="subpage-back-label">Back to editor</span>
        </button>
        {account && (
          <AccountMenu
            username={account.username}
            avatarUrl={account.avatarUrl}
            draftCount={countDraftAmbients(snapshot.ownedAmbients)}
            onOpenLibrary={() => navigate('/ambients')}
            onSignOut={signOut}
          />
        )}
      </header>

      <section className="ambient-library-body" aria-label="Your ambients">
        <div className="ambient-library-heading">
          <div>
            <span className="ambient-library-eyebrow">Ambient library</span>
            <h1>Your ambients</h1>
          </div>
          {!snapshot.isHydrated ? (
            <span className="skeleton ambient-library-skeleton-create" aria-hidden="true" />
          ) : account && snapshot.ownedAmbients.length > 0 ? (
            <button className="ui-button ui-button-primary" type="button" onClick={() => openWorkspace('new')}>
              Create ambient
            </button>
          ) : null}
        </div>
        {renderLibrary()}
      </section>

      <Toaster />

      {pendingDelete && (
        <DeleteAmbientDialog
          ambient={pendingDelete}
          isDeleting={isDeleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={deleteAmbient}
        />
      )}
    </main>
  )
}
