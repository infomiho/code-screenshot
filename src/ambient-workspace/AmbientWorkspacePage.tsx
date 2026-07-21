import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { loadAmbientDefinition } from '../ambient-registry'
import type { AmbientWorkspaceService } from './ambient-workspace-service'
import { AmbientWorkspaceHeader } from './AmbientWorkspaceHeader'
import { DiscardDraftDialog } from './DiscardDraftDialog'
import { DraftVersionComparison } from './DraftVersionComparison'
import { VersionSpine } from './VersionSpine'
import { WorkingDraftPreview } from './WorkingDraftPreview'
import { WorkspaceLoadingSkeleton } from './WorkspaceLoadingSkeleton'
import { WorkspaceSidebar } from './WorkspaceSidebar'
import { WorkspaceWorkPanel } from './WorkspaceWorkPanel'
import { useAgentWorkflow } from './use-agent-workflow'
import { useAmbientWorkspace } from './use-ambient-workspace'
import { useWorkspaceSidebar } from './use-workspace-sidebar'
import '../index.css'
import './ambient-workspace-page.css'

type AmbientWorkspacePageProps = {
  ambientId?: string
  ambientWorkspaceService?: AmbientWorkspaceService
  onClose?: () => void
}

type LoadState = 'loading' | 'setup' | 'ready' | 'not-found' | 'error'

export function AmbientWorkspacePage({
  ambientId: providedAmbientId,
  ambientWorkspaceService,
  onClose,
}: AmbientWorkspacePageProps = {}) {
  const navigate = useNavigate()
  const routeParams = useParams<'ambientId'>()
  const requestedAmbientId = providedAmbientId ?? routeParams.ambientId
  const { service, snapshot, workspaceDefinition } = useAmbientWorkspace(ambientWorkspaceService)
  const workflow = useAgentWorkflow(snapshot)
  const [createdAmbientId, setCreatedAmbientId] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<LoadState>(
    requestedAmbientId === 'new' ? 'setup' : 'loading',
  )
  const [ambientName, setAmbientName] = useState('')
  const [formError, setFormError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [isComparing, setIsComparing] = useState(false)
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const previousAcceptedChangeCountRef = useRef<number | null>(null)
  const previousWorkspaceIdRef = useRef<string | null>(null)
  const sidebar = useWorkspaceSidebar()
  const workspace = snapshot.workspace

  useEffect(() => {
    if (!snapshot.isHydrated || loadState === 'loading') {
      document.title = 'Loading ambient workspace | codeshot.dev'
    } else if (loadState === 'setup') {
      document.title = 'Create ambient | codeshot.dev'
    } else if (loadState === 'error') {
      document.title = 'Workspace unavailable | codeshot.dev'
    } else if (loadState === 'not-found' || !workspace) {
      document.title = 'Ambient not found | codeshot.dev'
    } else {
      document.title = `${workspace.ambient.name} workspace | codeshot.dev`
    }
  }, [loadState, snapshot.isHydrated, workspace])

  useEffect(() => {
    if (!snapshot.isHydrated || requestedAmbientId === 'new' || createdAmbientId) return
    if (!requestedAmbientId) {
      setLoadState('not-found')
      return
    }
    if (snapshot.account.kind !== 'signed-in' && snapshot.libraryStatus === 'ready') {
      setLoadState('error')
      return
    }

    let active = true
    setLoadState('loading')
    service.openWorkspace(requestedAmbientId).then((opened) => {
      if (active) setLoadState(opened ? 'ready' : 'not-found')
    }).catch(() => {
      if (active) setLoadState('error')
    })
    return () => {
      active = false
    }
  }, [createdAmbientId, requestedAmbientId, service, snapshot.account.kind, snapshot.isHydrated, snapshot.libraryStatus])

  useEffect(() => {
    if (!workspace) return
    setSelectedVersionId(workspace.versionInUse?.id ?? workspace.versions[0]?.id ?? null)
    setIsComparing(false)
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

  const createAmbient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = ambientName.trim()
    if (!name) {
      setFormError('Enter a name for this ambient.')
      nameInputRef.current?.focus()
      return
    }

    setFormError('')
    setIsCreating(true)
    try {
      const id = await service.createAmbient(name)
      if (!id) {
        setFormError('Could not create this ambient. Try again.')
        return
      }
      const accessCreated = await service.createAgentAccess()
      setCreatedAmbientId(id)
      setLoadState('ready')
      setStatusMessage(
        accessCreated
          ? `${name} created. Agent prompt is ready.`
          : `${name} created. Create agent access when you are ready.`,
      )
      navigate(`/ambients/${encodeURIComponent(id)}`, { replace: true })
    } catch {
      setFormError('Could not create this ambient. Try again.')
    } finally {
      setIsCreating(false)
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
    if (restored) setIsComparing(false)
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

  if (loadState === 'setup' && !createdAmbientId) {
    return (
      <main className="ambient-workspace-page">
        <h1 className="sr-only">Create ambient</h1>
        <AmbientWorkspaceHeader versionInUse={null} onClose={closeWorkspace} />
        <div className="workspace-layout">
          <section className="workspace-preview-panel workspace-setup-panel">
            <div className="workspace-setup-card">
              <span className="workspace-eyebrow">Ambient workspace</span>
              <h2>Name your ambient</h2>
              <p>Create a reusable visual frame. A temporary agent prompt will be ready in the workspace.</p>
              {snapshot.account.kind === 'signed-in' ? (
                <form onSubmit={createAmbient}>
                  <label htmlFor="ambient-name">Ambient name</label>
                  <input
                    ref={nameInputRef}
                    id="ambient-name"
                    name="ambientName"
                    maxLength={80}
                    value={ambientName}
                    aria-invalid={formError ? true : undefined}
                    onChange={(event) => setAmbientName(event.target.value)}
                    aria-describedby={formError ? 'ambient-name-error' : undefined}
                  />
                  {formError && <p id="ambient-name-error" className="workspace-form-error" role="alert">{formError}</p>}
                  <div className="workspace-setup-actions">
                    <button className="ui-button" type="button" onClick={closeWorkspace}>Cancel</button>
                    <button className="ui-button ui-button-primary" type="submit" disabled={isCreating}>
                      {isCreating ? 'Creating ambient...' : 'Create ambient'}
                    </button>
                  </div>
                </form>
              ) : (
                <button className="ui-button ui-button-primary" type="button" onClick={service.signIn}>
                  Sign in to create an ambient
                </button>
              )}
            </div>
          </section>
          <div className="workspace-activity-panel">
            <div className="workspace-sidebar">
              <div className="workspace-sidebar-tabs" aria-hidden="true">
                <button type="button" disabled>Work</button>
                <button type="button" disabled>Versions</button>
              </div>
              <div className="workspace-sidebar-panel">
                <div className="workspace-work-panel">
                  <section className="workspace-card workspace-status-card" aria-label="Draft status">
                    <h2>Your draft will appear here</h2>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (loadState === 'not-found' || !workspace) {
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
          onClick={() => {
            if (!isError || !requestedAmbientId) {
              closeWorkspace()
              return
            }
            setLoadState('loading')
            void service.openWorkspace(requestedAmbientId)
              .then((opened) => setLoadState(opened ? 'ready' : 'not-found'))
              .catch(() => setLoadState('error'))
          }}
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
        versionInUse={workspace.versionInUse?.version ?? null}
        onClose={closeWorkspace}
      />

      <div className="workspace-layout">
        <section id="workspace-preview-panel" className="workspace-preview-panel">
          {isComparing && selectedVersion ? (
            <DraftVersionComparison
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
            statusMessage={statusMessage}
            versionCount={workspace.versions.length}
            onTabChange={sidebar.setActiveTab}
            work={(
              <WorkspaceWorkPanel
                access={workflow.access}
                agentAccessUrl={workspace.agentAccessUrl}
                ambientName={workspace.ambient.name}
                canCompare={workspace.versionInUse !== null && workflow.draftSafety.status !== 'matches-version'}
                canMutate={workspace.connectivity === 'online'}
                canSave={canSave}
                discardLabel={workspace.versionInUse ? 'Discard changes' : 'Discard ambient'}
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
        isDiscarding={isDiscarding}
        isOpen={isDiscardDialogOpen}
        onCancel={() => setIsDiscardDialogOpen(false)}
        onConfirm={discardDraft}
        versionInUse={workspace.versionInUse?.version ?? null}
      />
    </main>
  )
}
