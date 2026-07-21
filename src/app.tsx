import { useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router'
import './index.css'
import type { YourAmbientsState } from './ambient-picker'
import {
  ambientDefinitions,
  defaultAmbientKey,
  getAmbientDefinition,
  getAmbientKey,
  resolveAmbientVariables,
  type AmbientCustomizationState,
  type ScreenshotContent,
} from './ambient-themes'
import { countDraftAmbients, type AmbientWorkspaceService } from './ambient-workspace/ambient-workspace-service'
import { useAmbientWorkspace } from './ambient-workspace/use-ambient-workspace'
import { ScreenshotControls } from './screenshot-controls'
import { ScreenshotPreview } from './screenshot-preview'
import { SiteHeader } from './site-header'
import { useCodeEditor } from './use-code-editor'

type AppProps = {
  ambientWorkspaceService?: AmbientWorkspaceService
  onOpenLibrary?: () => void
  onOpenWorkspace?: (ambientId: string) => void
}

const getAmbientIdFromKey = (key: string) => key.slice(0, key.lastIndexOf('@'))
const compositionStorageKey = 'codeshot.editor-composition'
const postAuthRouteStorageKey = 'codeshot.post-auth-route'
const postAuthIntentLifetime = 15 * 60 * 1000

type StoredComposition = {
  ambientCustomizations: AmbientCustomizationState
  ambientKey: string
  languageId: string
  title: string
}

const readStoredComposition = (): StoredComposition | null => {
  try {
    const value = globalThis.localStorage?.getItem(compositionStorageKey)
    return value ? JSON.parse(value) as StoredComposition : null
  } catch {
    return null
  }
}

export function App({ ambientWorkspaceService, onOpenLibrary, onOpenWorkspace }: AppProps = {}) {
  const navigate = useNavigate()
  const editorHelpId = `${useId()}-editor-help`
  const highlightStatusId = `${useId()}-highlight-status`
  const [storedComposition] = useState(readStoredComposition)
  const [languageId, setLanguageId] = useState(storedComposition?.languageId ?? 'typescript')
  const [ambientKey, setAmbientKey] = useState(storedComposition?.ambientKey ?? defaultAmbientKey)
  const [title, setTitle] = useState(storedComposition?.title ?? 'top secret code')
  const [ambientCustomizations, setAmbientCustomizations] = useState<AmbientCustomizationState>(
    storedComposition?.ambientCustomizations ?? {},
  )
  const [hasMounted, setHasMounted] = useState(false)
  const { definitions, service, snapshot } = useAmbientWorkspace(ambientWorkspaceService)
  const selectedAmbient = definitions.find(
    (definition) => getAmbientKey(definition) === ambientKey,
  ) ?? definitions.find(
    (definition) => definition.id === getAmbientIdFromKey(ambientKey),
  ) ?? getAmbientDefinition(defaultAmbientKey, definitions)
  const selectedAmbientKey = getAmbientKey(selectedAmbient)
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
  const screenshotContent: ScreenshotContent = {
    title,
    fileType: {
      id: selectedLanguage.id,
      label: selectedLanguage.label,
      syntax: selectedLanguage.lang,
    },
    lineCount: code.split('\n').length,
  }
  const ambientVariables = resolveAmbientVariables(selectedAmbient, ambientCustomizations)
  const isBuiltInAmbientKey = ambientDefinitions.some(
    (definition) =>
      getAmbientKey(definition) === ambientKey
      || definition.id === getAmbientIdFromKey(ambientKey),
  )
  const isFrameReady = hasMounted && (isBuiltInAmbientKey || snapshot.isHydrated)
  const draftCount = countDraftAmbients(snapshot.ownedAmbients)

  useEffect(() => {
    document.title = 'codeshot.dev | Beautiful code screenshots'
  }, [])

  useEffect(() => setHasMounted(true), [])

  useEffect(() => {
    if (!snapshot.isHydrated || snapshot.account.kind !== 'signed-in') return
    try {
      const value = globalThis.sessionStorage?.getItem(postAuthRouteStorageKey)
      if (!value) return
      globalThis.sessionStorage.removeItem(postAuthRouteStorageKey)
      const intent = JSON.parse(value) as { path: string; createdAt: number }
      if (intent.path !== '/ambients/new' || Date.now() - intent.createdAt > postAuthIntentLifetime) return
      openWorkspace('new')
    } catch {
      // The create flow remains available from the ambient library.
    }
  }, [snapshot.account.kind, snapshot.isHydrated])

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(compositionStorageKey, JSON.stringify({
        ambientCustomizations,
        ambientKey,
        languageId,
        title,
      } satisfies StoredComposition))
    } catch {
      // Local persistence is optional; the editor remains fully usable without it.
    }
  }, [ambientCustomizations, ambientKey, languageId, title])

  const openWorkspace = (ambientId: string) => {
    if (onOpenWorkspace) {
      onOpenWorkspace(ambientId)
    } else {
      navigate(`/ambients/${encodeURIComponent(ambientId)}`)
    }
  }

  const openLibrary = () => {
    if (onOpenLibrary) {
      onOpenLibrary()
    } else {
      navigate('/ambients')
    }
  }

  const createAmbient = () => {
    if (snapshot.account.kind === 'signed-out') {
      try {
        globalThis.sessionStorage?.setItem(postAuthRouteStorageKey, JSON.stringify({
          path: '/ambients/new',
          createdAt: Date.now(),
        }))
      } catch {
        // Authentication can continue without a persisted destination.
      }
      service.signIn()
      return
    }
    openWorkspace('new')
  }

  const yourAmbients: YourAmbientsState = snapshot.account.kind === 'signed-out'
    ? { kind: 'signed-out', onCreateAmbient: createAmbient }
    : {
        kind: 'signed-in',
        username: snapshot.account.username,
        hasAmbients: snapshot.ownedAmbients.length > 0,
        onCreateAmbient: createAmbient,
        onManageAmbients: openLibrary,
      }

  const updateAmbientCustomization = (slotId: string, value: string) => {
    setAmbientCustomizations((current) => ({
      ...current,
      [selectedAmbientKey]: {
        ...current[selectedAmbientKey],
        [slotId]: value,
      },
    }))
  }

  const signOut = () => {
    service.signOut()
    setAmbientKey(defaultAmbientKey)
  }

  return (
    <main className="app-shell">
      <h1 className="sr-only">codeshot.dev code screenshot tool</h1>
      <SiteHeader
        account={snapshot.account}
        isHydrated={snapshot.isHydrated}
        draftCount={draftCount}
        onOpenLibrary={openLibrary}
        onSignIn={service.signIn}
        onSignOut={signOut}
      />
      <section className="workspace" aria-label="Editable screenshot">
        <ScreenshotPreview
          ambientKey={selectedAmbientKey}
          definitions={definitions}
          yourAmbients={yourAmbients}
          onAmbientPickerOpenChange={() => undefined}
          onAmbientChange={setAmbientKey}
          selectedAmbient={selectedAmbient}
          screenshotContent={screenshotContent}
          ambientVariables={ambientVariables}
          editorHostRef={editorHostRef}
          editorHelpId={editorHelpId}
          isEditorReady={isEditorReady}
          isFrameReady={isFrameReady}
        />
        <ScreenshotControls
          ambientName={selectedAmbient.manifest.name}
          customizationSlots={selectedAmbient.manifest.customizations}
          customizationValues={selectedCustomizationValues}
          onCustomizationChange={updateAmbientCustomization}
          languageId={languageId}
          languageOptions={languageOptions}
          onLanguageChange={setLanguageId}
          title={title}
          onTitleChange={setTitle}
          highlightStatusId={highlightStatusId}
          highlightedLineCount={highlightedLineCount}
          highlightedLineStatus={highlightedLineStatus}
          onHighlightCurrentLine={highlightCurrentLine}
          onClearHighlights={clearHighlights}
        />
      </section>
      <footer className="site-footer">
        <a href="https://wasp.sh">Built with Wasp</a>
        <span aria-hidden="true">/</span>
        <a href="https://github.com/infomiho/code-screenshot">View the source</a>
      </footer>
    </main>
  )
}
