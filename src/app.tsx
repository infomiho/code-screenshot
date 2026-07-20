import {
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import './index.css'
import type { YourAmbientsState } from './ambient-picker'
import {
  defaultAmbientKey,
  getAmbientDefinition,
  getAmbientKey,
  resolveAmbientVariables,
  type AmbientCustomizationState,
  type ScreenshotContent,
} from './ambient-themes'
import { AgentDraftHud } from './ambient-workspace/agent-draft/AgentDraftHud'
import { getHudStatus } from './ambient-workspace/agent-draft/model'
import type {
  AmbientWorkspaceService,
  AmbientWorkspaceSnapshot,
  SavedAmbientRecord,
} from './ambient-workspace/ambient-workspace-service'
import { useAmbientWorkspace } from './ambient-workspace/use-ambient-workspace'
import { useAgentWorkflow } from './ambient-workspace/use-agent-workflow'
import { ScreenshotControls } from './screenshot-controls'
import { ScreenshotPreview } from './screenshot-preview'
import { SiteHeader } from './site-header'
import { useCodeEditor } from './use-code-editor'

type AppProps = {
  ambientWorkspaceService?: AmbientWorkspaceService
}

const getAmbientIdFromKey = (key: string) => key.slice(0, key.lastIndexOf('@'))

function createYourAmbientsState(
  workspace: AmbientWorkspaceSnapshot,
  actions: {
    beginAmbient: () => void
    editAmbient: (ambientId: string) => void
    openDraft: () => void
    signIn: () => void
  },
): YourAmbientsState {
  if (workspace.account.kind === 'signed-out') {
    return { kind: 'signed-out', onSignIn: actions.signIn }
  }

  return {
    kind: 'signed-in',
    username: workspace.account.username,
    draft: workspace.draft
      ? {
          actionLabel: workspace.draft.phase === 'saved' ? 'Open agent session' : 'Open draft',
          name: workspace.draft.ambientName ?? 'New ambient',
          status: getHudStatus(workspace.draft),
        }
      : null,
    canCreate: !workspace.draft || workspace.draft.phase === 'saved',
    onCreateAmbient: actions.beginAmbient,
    onEditAmbient: actions.editAmbient,
    onOpenDraft: actions.openDraft,
  }
}

export function App({ ambientWorkspaceService }: AppProps = {}) {
  const editorHelpId = `${useId()}-editor-help`
  const highlightStatusId = `${useId()}-highlight-status`
  const [languageId, setLanguageId] = useState('typescript')
  const [ambientKey, setAmbientKey] = useState(defaultAmbientKey)
  const [title, setTitle] = useState('top secret code')
  const initiatedDraftIdRef = useRef<string | null>(null)
  const {
    definitions,
    draftDefinition,
    service: workspaceService,
    snapshot: workspace,
  } = useAmbientWorkspace(ambientWorkspaceService)
  const agentWorkflow = useAgentWorkflow(workspace)
  const [ambientCustomizations, setAmbientCustomizations] =
    useState<AmbientCustomizationState>({})
  const selectedAmbient = definitions.find(
    (definition) => getAmbientKey(definition) === ambientKey,
  ) ?? definitions.find(
    (definition) => definition.id === getAmbientIdFromKey(ambientKey),
  ) ?? getAmbientDefinition(defaultAmbientKey, definitions)
  const selectedAmbientKey = getAmbientKey(selectedAmbient)
  const selectedCustomizationSlots = selectedAmbient.manifest.customizations
  const selectedCustomizationValues = ambientCustomizations[selectedAmbientKey]
  const ariaDescribedBy = `${editorHelpId} ${highlightStatusId}`
  const {
    languageOptions,
    selectedLanguage,
    code,
    editorHostRef,
    isEditorReady,
    highlightedLineCount,
    highlightedLineStatus,
    highlightCurrentLine,
    clearHighlights,
  } = useCodeEditor({
    languageId,
    ambientEditorExtension: selectedAmbient.editorExtension,
    ariaDescribedBy,
  })
  const selectedFileType: ScreenshotContent['fileType'] = {
    id: selectedLanguage.id,
    label: selectedLanguage.label,
    syntax: selectedLanguage.lang,
  }
  const screenshotContent: ScreenshotContent = {
    title,
    fileType: selectedFileType,
    lineCount: code.split('\n').length,
  }
  const ambientVariables = resolveAmbientVariables(
    selectedAmbient,
    ambientCustomizations,
  )

  useEffect(() => {
    const draft = workspace.draft
    if (!draft) {
      initiatedDraftIdRef.current = null
      return
    }

    const isNewClientDraft = draft.id === 'ambient-pending'
      || initiatedDraftIdRef.current === 'ambient-pending'
    initiatedDraftIdRef.current = draft.id === 'ambient-pending' ? draft.id : null
    if (!draftDefinition) return

    const isViewingThisAmbient = getAmbientIdFromKey(ambientKey) === draft.id
    if (isNewClientDraft || agentWorkflow.isOpen || isViewingThisAmbient) {
      setAmbientKey(getAmbientKey(draftDefinition))
    }
  }, [agentWorkflow.isOpen, ambientKey, draftDefinition, workspace.draft])

  const updateAmbientCustomization = (slotId: string, value: string) => {
    setAmbientCustomizations((current) => ({
      ...current,
      [selectedAmbientKey]: {
        ...current[selectedAmbientKey],
        [slotId]: value,
      },
    }))
  }

  const selectAmbient = (nextAmbientKey: string) => setAmbientKey(nextAmbientKey)
  const selectLanguage = (nextLanguageId: string) => setLanguageId(nextLanguageId)
  const updateTitle = (nextTitle: string) => setTitle(nextTitle)

  const beginAmbient = () => {
    agentWorkflow.send({ type: 'BEGIN' })
    workspaceService.beginAmbient()
  }

  const editAmbient = async (ambientId: string) => {
    if (!agentWorkflow.startMutation('EDIT_STARTED')) return
    agentWorkflow.send({ type: 'OPEN' })
    let opened = false
    try {
      opened = await workspaceService.editAmbient(ambientId)
    } catch {
      opened = false
    } finally {
      agentWorkflow.send({ type: 'EDIT_FINISHED' })
    }
    if (!opened) agentWorkflow.send({ type: 'RESET' })
  }

  const savePrivateVersion = async () => {
    if (!agentWorkflow.startMutation('SAVE_STARTED')) return
    let record: SavedAmbientRecord | null = null
    try {
      record = await workspaceService.savePrivateVersion()
    } catch {
      record = null
    } finally {
      agentWorkflow.send({ type: 'SAVE_FINISHED' })
    }
    if (record && workspaceService.getSnapshot().account.kind === 'signed-in') {
      setAmbientKey(`${record.id}@${record.version}`)
    }
  }

  const signOut = () => {
    workspaceService.signOut()
    agentWorkflow.send({ type: 'RESET' })
    setAmbientKey(defaultAmbientKey)
  }

  const updateAgentDockOpen = (isOpen: boolean) => {
    agentWorkflow.send({ type: isOpen ? 'OPEN' : 'MINIMIZE' })
  }

  const openAgentDraft = () => {
    const agentAmbient = draftDefinition
      ?? definitions.find((definition) => definition.id === workspace.draft?.id)
    if (agentAmbient) setAmbientKey(getAmbientKey(agentAmbient))
    agentWorkflow.send({ type: 'OPEN' })
    if (workspace.draft?.notice === 'unavailable' || workspace.draft?.notice === 'expired') {
      agentWorkflow.send({ type: 'RENEW_STARTED' })
      void workspaceService.renewAgentAccess()
    }
  }

  const exitAgentDraft = () => {
    agentWorkflow.send({ type: 'EXIT' })
  }

  const discardAgentDraft = async () => {
    const draftId = workspace.draft?.id
    if (!draftId) return false
    const savedVersion = workspace.savedAmbients.find((ambient) => ambient.id === draftId)
    if (!agentWorkflow.startMutation('DISCARD_STARTED')) return false
    let discarded = false
    try {
      discarded = await workspaceService.discardAmbientDraft()
    } catch {
      discarded = false
    } finally {
      agentWorkflow.send({ type: 'DISCARD_FINISHED' })
    }
    if (!discarded) return false

    agentWorkflow.send({ type: 'RESET' })
    setAmbientKey(savedVersion ? `${savedVersion.id}@${savedVersion.version}` : defaultAmbientKey)
    return true
  }

  const yourAmbients = createYourAmbientsState(workspace, {
    beginAmbient,
    editAmbient: (ambientId) => void editAmbient(ambientId),
    openDraft: openAgentDraft,
    signIn: workspaceService.signIn,
  })
  return (
    <main className="app-shell">
      <h1 className="sr-only">codeshot.dev code screenshot tool</h1>
      <SiteHeader
        account={workspace.account}
        onSignIn={workspaceService.signIn}
        onSignOut={signOut}
      />
      <section className="workspace" aria-label="Editable screenshot">
        <ScreenshotPreview
          ambientKey={selectedAmbientKey}
          definitions={definitions}
          yourAmbients={yourAmbients}
          onAmbientPickerOpenChange={(isOpen) => {
            if (isOpen && agentWorkflow.isOpen) updateAgentDockOpen(false)
          }}
          onAmbientChange={selectAmbient}
          selectedAmbient={selectedAmbient}
          screenshotContent={screenshotContent}
          ambientVariables={ambientVariables}
          editorHostRef={editorHostRef}
          editorHelpId={editorHelpId}
          isEditorReady={isEditorReady}
        />
        <ScreenshotControls
          ambientName={selectedAmbient.manifest.name}
          customizationSlots={selectedCustomizationSlots}
          customizationValues={selectedCustomizationValues}
          onCustomizationChange={updateAmbientCustomization}
          languageId={languageId}
          languageOptions={languageOptions}
          onLanguageChange={selectLanguage}
          title={title}
          onTitleChange={updateTitle}
          highlightStatusId={highlightStatusId}
          highlightedLineCount={highlightedLineCount}
          highlightedLineStatus={highlightedLineStatus}
          onHighlightCurrentLine={highlightCurrentLine}
          onClearHighlights={clearHighlights}
        />
      </section>
      {workspace.draft && agentWorkflow.isVisible && (
        <AgentDraftHud
          access={agentWorkflow.access}
          isOpen={agentWorkflow.isOpen}
          mutation={agentWorkflow.mutation}
          model={workspace.draft}
          onOpenChange={updateAgentDockOpen}
          onExit={exitAgentDraft}
          onCreateAmbient={(ambientName) => {
            if (!agentWorkflow.startMutation('CREATE_STARTED')) return
            void Promise.resolve(workspaceService.createAmbient(ambientName))
              .catch(() => undefined)
              .finally(() => agentWorkflow.send({ type: 'CREATE_FINISHED' }))
          }}
          onCopyPrompt={workspaceService.copyPrompt}
          onRenewAgentAccess={() => {
            agentWorkflow.send({ type: 'RENEW_STARTED' })
            void workspaceService.renewAgentAccess()
          }}
          onRetryConnection={workspaceService.retryConnection}
          onSavePrivateVersion={savePrivateVersion}
          onDiscardDraft={discardAgentDraft}
        />
      )}
      <footer className="site-footer">
        <a href="https://wasp.sh">Built with Wasp</a>
        <span aria-hidden="true">/</span>
        <a href="https://github.com/infomiho/code-screenshot">View the source</a>
      </footer>
    </main>
  )
}
