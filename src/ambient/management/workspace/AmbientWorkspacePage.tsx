import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { routes } from 'wasp/client/router'
import { loadAmbientDefinition } from '../../rendering/ambient-registry'
import { countDraftAmbients, type AmbientWorkspaceService } from '../ambient-workspace-service'
import { AmbientWorkspaceHeader } from './AmbientWorkspaceHeader'
import { DiscardDraftDialog } from './DiscardDraftDialog'
import { DraftVersionComparison } from './DraftVersionComparison'
import { usePreviewCustomizations } from './PreviewCustomizationStrip'
import { VersionSpine } from './VersionSpine'
import { WorkingDraftPreview } from './WorkingDraftPreview'
import { WorkspaceLoadingSkeleton } from './WorkspaceLoadingSkeleton'
import { WorkspaceSetupState } from './WorkspaceSetupState'
import { WorkspaceSidebar } from './WorkspaceSidebar'
import { WorkspaceWorkPanel } from './WorkspaceWorkPanel'
import { useAgentWorkflow } from '../agent/use-agent-workflow'
import { useAmbientWorkspace } from '../use-ambient-workspace'
import { useWorkspaceSidebar } from './use-workspace-sidebar'
import { Toaster } from '../../../ui/toast'
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
  const [statusMessage, setStatusMessage] = useState('')
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [isComparing, setIsComparing] = useState(false)
  const draftCustomizations = usePreviewCustomizations()
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false)
  const previousAcceptedChangeCountRef = useRef<number | null>(null)
  const previousWorkspaceIdRef = useRef<string | null>(null)
  const sidebar = useWorkspaceSidebar()
  const workspace = snapshot.workspace
  const loadState = createdAmbientId && workspace ? 'ready' : workspaceLoadState

  useEffect(() => {
    if (!snapshot.isHydrated || loadState === 'loading') {
      document.title = 'Loading ambient workspace | codeshot.dev'
    } else if (loadState === 'setup') {
      document.title = 'Create ambient | codeshot.dev'
    } else if (loadState === 'error') {
      document.title = 'Workspace unavailable | codeshot.dev'
    } else if (loadState === 'not-found') {
      document.title = 'Ambient not found | codeshot.dev'
    } else if (!workspace) {
      document.title = 'Loading ambient workspace | codeshot.dev'
    } else {
      document.title = `${workspace.ambient.name} workspace | codeshot.dev`
    }
  }, [loadState, snapshot.isHydrated, workspace])

  useEffect(() => {
    if (!workspace) return
    setSelectedVersionId(workspace.versionInUse?.id ?? workspace.versions[0]?.id ?? null)
    setIsComparing(false)
    draftCustomizations.onReset()
  }, [workspace?.ambient.id])

  useEffect(() => {
    if (!statusMessage) return
    const timer = window.setTimeout(() => setStatusMessage(''), 4500)
    return () => window.clearTimeout(timer)
  }, [statusMessage])

  useEffect(() => {
    const workspaceId = workspace?.ambient.id ?? null
    const changeCount = workspace?.workingDraft?.acceptedChangeCount ?? 0
    if (previousWorkspaceIdRef.current !== workspaceId) {
      previousWorkspaceIdRef.current = workspaceId
      previousAcceptedChangeCountRef.current = changeCount
      return
    }
    const previousCount = previousAcceptedChangeCountRef.current
    if (previousCount !== null && changeCount > previousCount) {
      setStatusMessage(
        `${changeCount - previousCount} agent ${changeCount - previousCount === 1 ? 'change' : 'changes'} accepted. Ready to review.`,
      )
    }
    previousAcceptedChangeCountRef.current = changeCount
  }, [workspace?.ambient.id, workspace?.workingDraft?.acceptedChangeCount])

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
      navigate('/ambients')
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

  const createAmbient = async (ambientName: string) => {
    try {
      const id = await service.createAmbient(ambientName)
      if (!id) {
        return false
      }
      trackProductEvent('Ambient Created', { surface: 'workspace' })
      const accessCreated = await service.createAgentAccess(id)
      setCreatedAmbientId(id)
      setStatusMessage(
        accessCreated
          ? `${ambientName} created. Agent prompt is ready.`
          : `${ambientName} created. Create agent access when you are ready.`,
      )
      navigate(`/ambients/${encodeURIComponent(id)}`, { replace: true })
      return true
    } catch {
      return false
    }
  }

  const createAccess = async () => {
    const startedFromVersion = workspace?.workingDraft ? null : workspace?.versionInUse?.version ?? null
    workflow.send({ type: 'ACCESS_STARTED' })
    const created = await service.createAgentAccess()
    if (!created) {
      setStatusMessage('Could not create agent access.')
    } else if (startedFromVersion !== null) {
      setStatusMessage(`New draft started from Version ${startedFromVersion}. Agent prompt is ready.`)
    } else {
      setStatusMessage('Temporary agent access created.')
    }
  }

  const discardAccess = async () => {
    const discarded = await service.discardAgentAccess()
    setStatusMessage(discarded ? 'Agent access ended. Your draft is safe.' : 'Could not end agent access.')
  }

  const saveVersion = async () => {
    workflow.send({ type: 'SAVE_STARTED' })
    setStatusMessage('Saving version...')
    const saved = await service.saveAmbientVersion()
    workflow.send({ type: 'MUTATION_FINISHED' })
    if (saved) {
      trackProductEvent('Ambient Version Saved', { surface: 'workspace' })
      setSelectedVersionId(saved.id)
      setStatusMessage(`Version ${saved.version} saved and now in use.`)
    } else {
      setStatusMessage('Could not save this version. Your draft remains available.')
    }
  }

  const restoreVersion = async () => {
    if (!selectedVersion) return
    workflow.send({ type: 'RESTORE_STARTED' })
    const restored = await service.createDraftFromVersion(selectedVersion.id)
    workflow.send({ type: 'MUTATION_FINISHED' })
    setStatusMessage(
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
      setStatusMessage('Could not discard the working draft.')
      return
    }
    draftCustomizations.onReset()
    if (shouldClose) {
      closeWorkspace()
    } else {
      setStatusMessage(`Draft changes discarded. Version ${workspace?.versionInUse?.version} remains available.`)
    }
  }

  const showComparison = (versionId?: string) => {
    const id = versionId ?? workspace?.versionInUse?.id
    if (!id) return
    setSelectedVersionId(id)
    setIsComparing(true)
  }

  if (!snapshot.isHydrated || loadState === 'loading') {
    return <WorkspaceLoadingSkeleton />
  }

  const draftCount = countDraftAmbients(snapshot.ownedAmbients)

  if (loadState === 'setup' && !createdAmbientId) {
    return (
      <WorkspaceSetupState
        account={snapshot.account}
        draftCount={draftCount}
        onCancel={closeWorkspace}
        onCreate={createAmbient}
        onSignIn={service.signIn}
        onSignOut={signOut}
      />
    )
  }

  if (loadState === 'not-found' || loadState === 'error') {
    const isError = loadState === 'error'
    return (
      <main className="workspace-route-state" role={isError ? 'alert' : undefined}>
        <span className="workspace-eyebrow">Ambient workspace</span>
        <h1>{isError ? 'Workspace unavailable' : 'Ambient not found'}</h1>
        <p>{isError ? 'The workspace could not be opened. Try again from your ambient library.' : 'This ambient does not exist or is not available to this account.'}</p>
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
          {isError ? 'Retry workspace' : 'Your ambients'}
        </button>
        {isError && (
          <button className="workspace-secondary-link" type="button" onClick={closeWorkspace}>
            Your ambients
          </button>
        )}
      </main>
    )
  }

  if (!workspace) {
    return <WorkspaceLoadingSkeleton />
  }

  const draftMatchesVersion = workflow.draftSafety.status === 'matches-version'
  const discardLabel = !workspace.versionInUse
    ? 'Discard ambient'
    : draftMatchesVersion ? 'Close draft' : 'Discard changes'
  const isSaving = workspace.mutation === 'saving' || workflow.workspace.status === 'saving'
  const isDiscarding = workspace.mutation === 'discarding'
  const canSave = Boolean(workspace.workingDraft)
    && workflow.draftSafety.status !== 'matches-version'
    && workspace.connectivity === 'online'
    && workspace.mutation === 'idle'

  return (
    <main className="ambient-workspace-page">
      <h1 className="sr-only">{workspace.ambient.name}</h1>
      <AmbientWorkspaceHeader
        account={snapshot.account}
        draftCount={draftCount}
        hasSavedVersion={workspace.versionInUse !== null}
        linkSharing={workspace.ambient.linkSharing}
        slug={workspace.ambient.slug}
        onClose={closeWorkspace}
        onOpenAdmin={() => navigate(routes.AdminRoute.to)}
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
            statusMessage={statusMessage}
            versionCount={workspace.versions.length}
            onTabChange={sidebar.setActiveTab}
            onToggleCollapse={sidebar.toggleCollapsed}
            work={(
              <WorkspaceWorkPanel
                access={workflow.access}
                agentAccessUrl={workspace.agentAccessUrl}
                ambientName={workspace.ambient.name}
                canCompare={workspace.versionInUse !== null && workflow.draftSafety.status !== 'matches-version'}
                canMutate={workspace.connectivity === 'online'}
                canSave={canSave}
                discardLabel={discardLabel}
                draftSafety={workflow.draftSafety}
                hasWorkingDraft={workspace.workingDraft !== null}
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
                onStatus={setStatusMessage}
              />
            )}
            versions={(
              <VersionSpine
                acceptedChangeCount={workspace.workingDraft?.acceptedChangeCount ?? 0}
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
