import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { routes } from 'wasp/client/router'
import { readGuestToken, rememberClaimIntent } from '../../../account/guest-session'
import { createTheme } from '../create-theme'
import { loadAmbientDefinition } from '../../rendering/ambient-registry'
import { countDraftAmbients, type AmbientWorkspaceService } from '../ambient-workspace-service'
import { AmbientWorkspaceHeader } from './AmbientWorkspaceHeader'
import { DiscardDraftDialog } from './DiscardDraftDialog'
import { DraftVersionComparison } from './DraftVersionComparison'
import { usePreviewCustomizations } from './PreviewCustomizationStrip'
import { VersionSpine } from './VersionSpine'
import { WorkingDraftPreview } from './WorkingDraftPreview'
import { WorkspaceLoadingSkeleton } from './WorkspaceLoadingSkeleton'
import { WorkspaceSidebar } from './WorkspaceSidebar'
import { WorkspaceWorkPanel } from './WorkspaceWorkPanel'
import { useAgentWorkflow } from '../agent/use-agent-workflow'
import { useAmbientWorkspace } from '../use-ambient-workspace'
import { useWorkspaceSidebar } from './use-workspace-sidebar'
import { Toaster, toastManager } from '../../../ui/toast'
import '../../../index.css'
import './ambient-workspace-page.css'
import { trackProductEvent } from '../../../product-metrics/events'

type AmbientWorkspacePageProps = {
  ambientId?: string
  ambientWorkspaceService?: AmbientWorkspaceService
  onClose?: () => void
}

export function AmbientWorkspacePage({
  ambientId: providedAmbientId,
  ambientWorkspaceService,
  onClose,
}: AmbientWorkspacePageProps = {}) {
  const navigate = useNavigate()
  const location = useLocation()
  const routeParams = useParams<'ambientId'>()
  const requestedAmbientId = providedAmbientId ?? routeParams.ambientId
  const {
    service,
    snapshot,
    workspaceDefinition,
    workspaceLoadState,
  } = useAmbientWorkspace(ambientWorkspaceService, requestedAmbientId)
  const workflow = useAgentWorkflow(snapshot)
  const [createdAmbientId, setCreatedAmbientId] = useState<string | null>(null)
  const [creationFailed, setCreationFailed] = useState(false)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [isComparing, setIsComparing] = useState(false)
  const draftCustomizations = usePreviewCustomizations()
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false)
  const previousAcceptedChangeCountRef = useRef<number | null>(null)
  const previousWorkspaceIdRef = useRef<string | null>(null)
  const nudgedAmbientIdRef = useRef<string | null>(null)
  const creationStartedRef = useRef(false)
  const sidebar = useWorkspaceSidebar()
  const notify = (description: string, priority: 'low' | 'high' = 'low') =>
    toastManager.add({ description, priority })
  const workspace = snapshot.workspace
  const loadState = createdAmbientId && workspace ? 'ready' : workspaceLoadState
  const ownership = workspace?.ambient.ownership ?? 'owned'
  const isGuest = ownership === 'guest'
  const acceptedChangeCount = workspace?.workingDraft?.acceptedChangeCount ?? 0
  const draftMatchesVersion = workflow.draftSafety.status === 'matches-version'
  const isSaving = workspace?.mutation === 'saving' || workflow.workspace.status === 'saving'
  const canSave = Boolean(workspace?.workingDraft)
    && !draftMatchesVersion
    && workspace?.connectivity === 'online'
    && workspace?.mutation === 'idle'

  useEffect(() => {
    if (!snapshot.isHydrated || loadState === 'loading') {
      document.title = 'Loading theme workspace | codeshot.dev'
    } else if (loadState === 'setup') {
      document.title = 'New theme | codeshot.dev'
    } else if (loadState === 'error') {
      document.title = 'Workspace unavailable | codeshot.dev'
    } else if (loadState === 'not-found') {
      document.title = 'Theme not found | codeshot.dev'
    } else if (!workspace) {
      document.title = 'Loading theme workspace | codeshot.dev'
    } else {
      document.title = `${workspace.ambient.name} workspace | codeshot.dev`
    }
  }, [loadState, snapshot.isHydrated, workspace])

  // The guard is never released on failure: `service` is a new object each render, so a released
  // guard would retry the create endpoint on every render.
  useEffect(() => {
    if (loadState !== 'setup' || creationStartedRef.current) return
    creationStartedRef.current = true
    void createTheme(service, snapshot.account, 'workspace').then((ambientId) => {
      if (!ambientId) {
        setCreationFailed(true)
        return
      }
      setCreatedAmbientId(ambientId)
      navigate(`/themes/${encodeURIComponent(ambientId)}`, { replace: true })
    })
  }, [loadState])

  const retryCreation = () => {
    creationStartedRef.current = false
    setCreationFailed(false)
  }

  useEffect(() => {
    if (!workspace) return
    setSelectedVersionId(workspace.versionInUse?.id ?? workspace.versions[0]?.id ?? null)
    setIsComparing(false)
    draftCustomizations.onReset()
  }, [workspace?.ambient.id])

  useEffect(() => {
    const workspaceId = workspace?.ambient.id ?? null
    if (previousWorkspaceIdRef.current !== workspaceId) {
      previousWorkspaceIdRef.current = workspaceId
      previousAcceptedChangeCountRef.current = acceptedChangeCount
      return
    }
    const previousCount = previousAcceptedChangeCountRef.current
    if (previousCount !== null && acceptedChangeCount > previousCount) {
      notify(
        `${acceptedChangeCount - previousCount} agent ${acceptedChangeCount - previousCount === 1 ? 'change' : 'changes'} accepted. Ready to review.`,
      )
      if (isGuest && previousCount === 0 && workspaceId && nudgedAmbientIdRef.current !== workspaceId) {
        nudgedAmbientIdRef.current = workspaceId
        toastManager.add({
          id: 'guest-save-nudge',
          description: 'Your theme is taking shape. Sign in when you want to keep it.',
        })
      }
    }
    previousAcceptedChangeCountRef.current = acceptedChangeCount
  }, [acceptedChangeCount, isGuest, workspace?.ambient.id])

  useEffect(() => {
    if (!isGuest || acceptedChangeCount === 0) return
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [acceptedChangeCount, isGuest])

  const selectedVersion = workspace?.versions.find((version) => version.id === selectedVersionId) ?? null
  const selectedVersionDefinition = useMemo(() => {
    if (!selectedVersion) return null
    return loadAmbientDefinition(selectedVersion, 'saved').definition
  }, [selectedVersion])
  const versionInUseDefinition = useMemo(() => {
    if (!workspace?.versionInUse) return null
    return loadAmbientDefinition(workspace.versionInUse, 'saved').definition
  }, [workspace?.versionInUse])

  const closeWorkspace = () => {
    service.closeWorkspace()
    if (onClose) {
      onClose()
    } else {
      navigate(isGuest ? '/' : '/themes')
    }
  }

  const signOut = async () => {
    await service.signOut()
    if (onClose) {
      onClose()
    } else {
      navigate('/')
    }
  }

  const retryOpenWorkspace = () => {
    if (!requestedAmbientId) {
      return
    }
    void service.openWorkspace(requestedAmbientId)
      .catch(() => undefined)
  }

  const createAccess = async () => {
    const startedFromVersion = workspace?.workingDraft ? null : workspace?.versionInUse?.version ?? null
    workflow.send({ type: 'ACCESS_STARTED' })
    const created = await service.createAgentAccess()
    if (!created) {
      notify('Could not create agent access.')
    } else if (startedFromVersion !== null) {
      notify(`New draft started from Version ${startedFromVersion}. Agent prompt is ready.`)
    } else {
      notify('Temporary agent access created.')
    }
  }

  const discardAccess = async () => {
    const discarded = await service.discardAgentAccess()
    notify(discarded ? 'Agent access ended. Your draft is safe.' : 'Could not end agent access.')
  }

  const saveVersion = async () => {
    workflow.send({ type: 'SAVE_STARTED' })
    notify('Saving version...')
    const saved = await service.saveAmbientVersion()
    workflow.send({ type: 'MUTATION_FINISHED' })
    if (saved) {
      trackProductEvent('Ambient Version Saved', { surface: 'workspace' })
      setSelectedVersionId(saved.id)
      notify(`Version ${saved.version} saved and now in use.`)
    } else {
      notify('Could not save this version. Your draft remains available.')
    }
  }

  const signIn = (saveOnReturn: boolean) => {
    const guestToken = readGuestToken()
    if (guestToken && workspace) {
      rememberClaimIntent({ guestToken, ambientId: workspace.ambient.id, saveOnReturn })
    }
    service.signIn()
  }

  useEffect(() => {
    const arrivalState = location.state as { saveOnArrival?: boolean } | null
    if (!arrivalState?.saveOnArrival || !canSave) return
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: null },
    )
    void saveVersion()
  }, [canSave, location.hash, location.pathname, location.search, location.state, navigate])

  const renameAmbient = async (name: string) => {
    const renamed = await service.renameAmbient(name)
    if (!renamed) notify('Could not rename this theme.', 'high')
    return renamed
  }

  const restoreVersion = async () => {
    if (!selectedVersion) return
    workflow.send({ type: 'RESTORE_STARTED' })
    const restored = await service.createDraftFromVersion(selectedVersion.id)
    workflow.send({ type: 'MUTATION_FINISHED' })
    notify(
      restored
        ? `Working draft started from Version ${selectedVersion.version}. Saved history is unchanged.`
        : `Could not start a draft from Version ${selectedVersion.version}.`,
    )
    if (restored) {
      setIsComparing(false)
      draftCustomizations.onReset()
    }
  }

  const discardDraft = async () => {
    workflow.send({ type: 'DISCARD_STARTED' })
    const shouldClose = workspace?.versionInUse === null
    const discarded = await service.discardAmbientDraft()
    workflow.send({ type: 'MUTATION_FINISHED' })
    setIsDiscardDialogOpen(false)
    if (!discarded) {
      notify('Could not discard the working draft.')
      return
    }
    draftCustomizations.onReset()
    if (shouldClose) {
      closeWorkspace()
    } else {
      notify(`Draft changes discarded. Version ${workspace?.versionInUse?.version} remains available.`)
    }
  }

  const showComparison = (versionId?: string) => {
    const id = versionId ?? workspace?.versionInUse?.id
    if (!id) return
    setSelectedVersionId(id)
    setIsComparing(true)
  }

  if (creationFailed) {
    return (
      <main className="workspace-route-state" role="alert">
        <span className="workspace-eyebrow">Theme workspace</span>
        <h1>Could not start a theme</h1>
        <p>The theme could not be created. Check your connection and try again.</p>
        <button className="ui-button ui-button-primary" type="button" onClick={retryCreation}>
          Try again
        </button>
        <button className="ui-button" type="button" onClick={() => navigate('/')}>
          Back to editor
        </button>
      </main>
    )
  }

  if (!snapshot.isHydrated || loadState === 'loading' || loadState === 'setup') {
    return <WorkspaceLoadingSkeleton />
  }

  const draftCount = countDraftAmbients(snapshot.ownedAmbients)

  if (loadState === 'not-found' || loadState === 'error') {
    const isError = loadState === 'error'
    return (
      <main className="workspace-route-state" role={isError ? 'alert' : undefined}>
        <span className="workspace-eyebrow">Theme workspace</span>
        <h1>{isError ? 'Workspace unavailable' : 'Theme not found'}</h1>
        <p>{isError ? 'The workspace could not be opened. Try again from your themes.' : 'This theme does not exist or is not available here.'}</p>
        {snapshot.account.kind === 'signed-out' && (
          <button className="ui-button ui-button-primary" type="button" onClick={service.signIn}>
            Sign in to open workspace
          </button>
        )}
        <button
          className="ui-button"
          type="button"
          onClick={isError && requestedAmbientId ? retryOpenWorkspace : closeWorkspace}
        >
          {isError ? 'Retry workspace' : 'Your themes'}
        </button>
        {isError && (
          <button className="workspace-secondary-link" type="button" onClick={closeWorkspace}>
            Your themes
          </button>
        )}
      </main>
    )
  }

  if (!workspace) {
    return <WorkspaceLoadingSkeleton />
  }

  const discardLabel = !workspace.versionInUse
    ? 'Discard theme'
    : draftMatchesVersion ? 'Close draft' : 'Discard changes'
  const isDiscarding = workspace.mutation === 'discarding'

  return (
    <main className="ambient-workspace-page">
      <h1 className="sr-only">{workspace.ambient.name}</h1>
      <AmbientWorkspaceHeader
        account={snapshot.account}
        draftCount={draftCount}
        hasSavedVersion={workspace.versionInUse !== null}
        hasUnsavedChanges={!draftMatchesVersion && workspace.workingDraft !== null}
        linkSharing={workspace.ambient.linkSharing}
        name={workspace.ambient.name}
        ownership={ownership}
        slug={workspace.ambient.slug}
        versionInUse={workspace.versionInUse?.version ?? null}
        onClose={closeWorkspace}
        onOpenAdmin={() => navigate(routes.AdminRoute.to)}
        onRename={renameAmbient}
        onSignIn={() => signIn(false)}
        onSignOut={signOut}
        onSharingChange={service.setLinkSharing}
      />

      <div className="workspace-layout" data-sidebar={sidebar.isCollapsed ? 'collapsed' : 'expanded'}>
        <section id="workspace-preview-panel" className="workspace-preview-panel">
          {isComparing && selectedVersion ? (
            <DraftVersionComparison
              key={selectedVersion.id}
              draftCustomizations={draftCustomizations}
              draftDefinition={workspaceDefinition}
              isRestoring={workspace.mutation === 'restoring'}
              onClose={() => setIsComparing(false)}
              onRestore={restoreVersion}
              version={selectedVersion}
              versionDefinition={selectedVersionDefinition}
            />
          ) : (
            <WorkingDraftPreview
              ambientName={workspace.ambient.name}
              customizations={draftCustomizations}
              definition={workspaceDefinition}
              versionInUse={workspace.versionInUse?.version ?? null}
              versionInUseDefinition={versionInUseDefinition}
              canStartDraft={workspace.connectivity === 'online' && workspace.mutation === 'idle'}
              onStartDraft={createAccess}
            />
          )}
        </section>

        <div className="workspace-activity-panel">
          <WorkspaceSidebar
            activeTab={sidebar.activeTab}
            isCollapsed={sidebar.isCollapsed}
            versionCount={workspace.versions.length}
            onTabChange={sidebar.setActiveTab}
            onToggleCollapse={sidebar.toggleCollapsed}
            work={(
              <WorkspaceWorkPanel
                access={workflow.access}
                agentAccessUrl={workspace.agentAccessUrl}
                ambientName={workspace.ambient.name}
                canCompare={workspace.versionInUse !== null && !draftMatchesVersion}
                canMutate={workspace.connectivity === 'online'}
                canSave={canSave}
                discardLabel={discardLabel}
                draftSafety={workflow.draftSafety}
                hasWorkingDraft={workspace.workingDraft !== null}
                isGuest={isGuest}
                isSaving={isSaving}
                versionInUse={workspace.versionInUse?.version ?? null}
                view={workflow.workspace}
                onCompare={() => showComparison()}
                onCopyPrompt={service.copyPrompt}
                onCreateAccess={createAccess}
                onDiscardAccess={discardAccess}
                onDiscardDraft={() => setIsDiscardDialogOpen(true)}
                onRetry={() => {
                  void service.openWorkspace(workspace.ambient.id).catch(() => undefined)
                }}
                onSave={saveVersion}
                onSignInToSave={() => signIn(true)}
              />
            )}
            versions={(
              <VersionSpine
                acceptedChangeCount={acceptedChangeCount}
                isDraftSelected={!isComparing}
                onSelectDraft={() => setIsComparing(false)}
                onSelectVersion={showComparison}
                selectedVersionId={isComparing ? selectedVersionId : null}
                versions={workspace.versions}
              />
            )}
          />
        </div>
      </div>

      <DiscardDraftDialog
        draftMatchesVersion={draftMatchesVersion}
        isDiscarding={isDiscarding}
        isOpen={isDiscardDialogOpen}
        onCancel={() => setIsDiscardDialogOpen(false)}
        onConfirm={discardDraft}
        versionInUse={workspace.versionInUse?.version ?? null}
      />
      <Toaster />
    </main>
  )
}
