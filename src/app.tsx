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
} from './ambient-workspace/ambient-workspace-service'
import { useAmbientWorkspace } from './ambient-workspace/use-ambient-workspace'
import { ScreenshotControls } from './screenshot-controls'
import { ScreenshotPreview } from './screenshot-preview'
import { SiteHeader } from './site-header'
import { useCodeEditor } from './use-code-editor'

type AppProps = {
  ambientWorkspaceService?: AmbientWorkspaceService
}

const getDraftRevisionKey = (draft: AmbientWorkspaceSnapshot['draft']) =>
  draft ? `${draft.id}@${draft.revision}` : null

const getAmbientIdFromKey = (key: string) => key.slice(0, key.lastIndexOf('@'))

function createYourAmbientsState(
  workspace: AmbientWorkspaceSnapshot,
  actions: {
    beginAmbient: () => void
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
    onOpenDraft: actions.openDraft,
  }
}

export function App({ ambientWorkspaceService }: AppProps = {}) {
  const editorHelpId = `${useId()}-editor-help`
  const highlightStatusId = `${useId()}-highlight-status`
  const [languageId, setLanguageId] = useState('typescript')
  const [ambientKey, setAmbientKey] = useState(defaultAmbientKey)
  const [title, setTitle] = useState('top secret code')
  const [isAgentDockOpen, setIsAgentDockOpen] = useState(false)
  const [dismissedAgentDraftKey, setDismissedAgentDraftKey] = useState<string | null>(null)
  const {
    definitions,
    draftDefinition,
    service: workspaceService,
    snapshot: workspace,
  } = useAmbientWorkspace(ambientWorkspaceService)
  const lastDraftRef = useRef<{ id: string | null; revision: number }>({
    id: null,
    revision: 0,
  })
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
    if (!draftDefinition || !draft) return

    const isInitialDraft = draft.revision === 0
      && (draft.phase === 'setup' || draft.phase === 'handoff')
    if (isInitialDraft) {
      lastDraftRef.current = { id: draft.id, revision: draft.revision }
      setAmbientKey(getAmbientKey(draftDefinition))
      return
    }
    if (draft.phase !== 'review') return

    const previousDraft = lastDraftRef.current
    const isFirstAcceptedChange = previousDraft.id !== draft.id || previousDraft.revision === 0
    const isViewingThisAmbient = getAmbientIdFromKey(ambientKey) === draft.id
    lastDraftRef.current = { id: draft.id, revision: draft.revision }
    if (isFirstAcceptedChange || isViewingThisAmbient) {
      setAmbientKey(getAmbientKey(draftDefinition))
    }
  }, [ambientKey, draftDefinition, workspace.draft])

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
    setDismissedAgentDraftKey(null)
    workspaceService.beginAmbient()
    setIsAgentDockOpen(true)
  }

  const savePrivateVersion = async () => {
    const record = await workspaceService.savePrivateVersion()
    if (record && workspaceService.getSnapshot().account.kind === 'signed-in') {
      setAmbientKey(`${record.id}@${record.version}`)
    }
  }

  const signOut = () => {
    workspaceService.signOut()
    setDismissedAgentDraftKey(null)
    setAmbientKey(defaultAmbientKey)
    setIsAgentDockOpen(false)
  }

  const updateAgentDockOpen = (isOpen: boolean) => {
    setIsAgentDockOpen(isOpen)
  }

  const openAgentDraft = () => {
    setDismissedAgentDraftKey(null)
    setIsAgentDockOpen(true)
  }

  const exitAgentDraft = () => {
    setDismissedAgentDraftKey(getDraftRevisionKey(workspace.draft))
    setIsAgentDockOpen(false)
  }

  const yourAmbients = createYourAmbientsState(workspace, {
    beginAmbient,
    openDraft: openAgentDraft,
    signIn: workspaceService.signIn,
  })
  const isAgentDraftDismissed = dismissedAgentDraftKey === getDraftRevisionKey(workspace.draft)
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
            if (isOpen) updateAgentDockOpen(false)
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
      {workspace.draft && !isAgentDraftDismissed && (
        <AgentDraftHud
          isOpen={isAgentDockOpen}
          model={workspace.draft}
          onOpenChange={updateAgentDockOpen}
          onExit={exitAgentDraft}
          onCreateAmbient={workspaceService.createAmbient}
          onCopyPrompt={workspaceService.copyPrompt}
          onRenewAgentAccess={workspaceService.renewAgentAccess}
          onRetryConnection={workspaceService.retryConnection}
          onSavePrivateVersion={savePrivateVersion}
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
