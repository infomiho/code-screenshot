import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { routes } from 'wasp/client/router'
import './index.css'
import { readGuestToken, takeClaimIntent } from './account/guest-session'
import { createTheme } from './ambient/management/create-theme'
import type { YourAmbientsState } from './ambient/selection/ambient-picker'
import {
  ambientDefinitions,
  defaultAmbientKey,
  getAmbientDefinition,
  getAmbientKey,
  resolveAmbientVariables,
  type AmbientCustomizationState,
  type ScreenshotContent,
} from './ambient/rendering/ambient-themes'
import { countDraftAmbients, type AmbientWorkspaceService } from './ambient/management/ambient-workspace-service'
import { useAmbientWorkspace } from './ambient/management/use-ambient-workspace'
import { ScreenshotControls } from './screenshot/screenshot-controls'
import { ScreenshotPreview } from './screenshot/screenshot-preview'
import { SiteHeader } from './site-header'
import { Toaster, toastManager } from './ui/toast'
import { useCodeEditor } from './screenshot/use-code-editor'
import { loadAmbientDefinition } from './ambient/rendering/ambient-registry'
import type { SavedAmbientRecord } from './ambient/management/ambient-workspace-service'
import { copyAmbientShareLink } from './ambient/management/sharing/copy-share-link'
import { trackProductEvent } from './product-metrics/events'
import type { AmbientToolbarActionState } from './ambient/selection/ambient-actions-menu'

type SharedAmbientSource = {
  record: SavedAmbientRecord
  shareId: string
  isOwnedByViewer: boolean
}

type AppProps = {
  ambientWorkspaceService?: AmbientWorkspaceService
  onOpenLibrary?: () => void
  onOpenWorkspace?: (ambientId: string) => void
  sharedAmbient?: SharedAmbientSource
}

const getAmbientIdFromKey = (key: string) => key.slice(0, key.lastIndexOf('@'))
const compositionStorageKey = 'codeshot.editor-composition'
// Superseded by the claim intent. Draining it keeps a sign in that was in flight during the deploy
// from resuming a route that no longer exists.
const retiredPostAuthRouteKey = 'codeshot.post-auth-route'

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

export function App({
  ambientWorkspaceService,
  onOpenLibrary,
  onOpenWorkspace,
  sharedAmbient,
}: AppProps = {}) {
  const navigate = useNavigate()
  const location = useLocation()
  const editorHelpId = `${useId()}-editor-help`
  const highlightStatusId = `${useId()}-highlight-status`
  const [storedComposition] = useState(readStoredComposition)
  const [languageId, setLanguageId] = useState(storedComposition?.languageId ?? 'typescript')
  const sharedDefinition = useMemo(
    () => sharedAmbient ? loadAmbientDefinition(sharedAmbient.record, 'shared').definition : null,
    [sharedAmbient],
  )
  const [ambientKey, setAmbientKey] = useState(
    sharedDefinition ? getAmbientKey(sharedDefinition) : storedComposition?.ambientKey ?? defaultAmbientKey,
  )
  const [title, setTitle] = useState(storedComposition?.title ?? 'top secret code')
  const [ambientCustomizations, setAmbientCustomizations] = useState<AmbientCustomizationState>(
    storedComposition?.ambientCustomizations ?? {},
  )
  const [hasMounted, setHasMounted] = useState(false)
  const [isCreatingTheme, setIsCreatingTheme] = useState(false)
  const creationInFlightRef = useRef(false)
  const claimStartedRef = useRef(false)
  const workspace = useAmbientWorkspace(ambientWorkspaceService)
  const { service, snapshot } = workspace
  const definitions = useMemo(() => {
    if (!sharedDefinition) return workspace.definitions
    const sharedKey = getAmbientKey(sharedDefinition)
    if (workspace.definitions.some((definition) => getAmbientKey(definition) === sharedKey)) {
      return workspace.definitions
    }
    return [...workspace.definitions, sharedDefinition]
  }, [sharedDefinition, workspace.definitions])
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
  const selectedOwnedAmbient = snapshot.ownedAmbients.find(
    (ambient) => ambient.id === selectedAmbient.id,
  )

  useEffect(() => {
    document.title = 'codeshot.dev | Beautiful code screenshots'
  }, [])

  useEffect(() => setHasMounted(true), [])

  useEffect(() => {
    const state = location.state as { toast?: unknown } | null
    if (typeof state?.toast !== 'string') return
    toastManager.add({ id: 'navigation-toast', description: state.toast })
    navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, {
      replace: true,
      state: null,
    })
  }, [location.hash, location.pathname, location.search, location.state, navigate])

  useEffect(() => {
    try {
      globalThis.sessionStorage?.removeItem(retiredPostAuthRouteKey)
    } catch {
      // Nothing to drain when session storage is unavailable.
    }
  }, [])

  // Signing in always adopts this browser's anonymous work, so no signed-in visitor holds a theme
  // they can no longer reach. The stored intent only decides where they land afterwards.
  useEffect(() => {
    if (!snapshot.isHydrated || snapshot.account.kind !== 'signed-in') return
    if (claimStartedRef.current || !readGuestToken()) return
    claimStartedRef.current = true
    const intent = takeClaimIntent()
    void service.claimGuestWork().then((result) => {
      if (!result || !intent) return
      if (!result.claimedAmbientIds.includes(intent.ambientId)) {
        toastManager.add({
          id: 'claim-discarded',
          description: 'Signed in. That theme was still empty, so it was not kept.',
        })
        return
      }
      navigate(`/themes/${encodeURIComponent(intent.ambientId)}`, {
        replace: true,
        state: { saveOnArrival: intent.saveOnReturn },
      })
    })
  }, [navigate, service, snapshot.account.kind, snapshot.isHydrated])

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
      navigate(`/themes/${encodeURIComponent(ambientId)}`)
    }
  }

  const openLibrary = () => {
    if (onOpenLibrary) {
      onOpenLibrary()
    } else {
      navigate('/themes')
    }
  }

  const openAdmin = () => navigate(routes.AdminRoute.to)

  // Creating a theme never asks for an account. The visitor lands straight in the workspace with a
  // name already in place, and only saving requires signing in.
  const createAmbient = async () => {
    if (creationInFlightRef.current) return
    creationInFlightRef.current = true
    setIsCreatingTheme(true)
    let ambientId: string | null = null
    try {
      ambientId = sharedAmbient
        ? await service.copySharedAmbient(sharedAmbient.shareId)
        : await createTheme(service, snapshot.account, 'landing')
      if (ambientId && sharedAmbient) {
        trackProductEvent('Ambient Created', {
          surface: 'shared',
          account: snapshot.account.kind === 'signed-in' ? 'signed-in' : 'anonymous',
          ambient_source: 'shared',
        })
        await service.createAgentAccess(ambientId)
      }
    } finally {
      creationInFlightRef.current = false
      setIsCreatingTheme(false)
    }
    if (!ambientId) {
      toastManager.add({
        id: sharedAmbient ? 'copy-theme-failed' : 'create-theme-failed',
        description: sharedAmbient
          ? 'Could not copy this theme. Try again.'
          : 'Could not start a new theme. Try again.',
      })
      return
    }
    openWorkspace(ambientId)
  }

  const startAmbient = () => void createAmbient()
  const yourAmbients: YourAmbientsState = snapshot.account.kind === 'signed-out'
    ? { kind: 'signed-out' }
    : { kind: 'signed-in' }

  const updateAmbientCustomization = (slotId: string, value: string) => {
    setAmbientCustomizations((current) => ({
      ...current,
      [selectedAmbientKey]: {
        ...current[selectedAmbientKey],
        [slotId]: value,
      },
    }))
  }

  const signOut = async () => {
    await service.signOut()
    setAmbientKey(defaultAmbientKey)
  }

  const exitSharedAmbient = () => {
    try {
      globalThis.localStorage?.setItem(compositionStorageKey, JSON.stringify({
        ambientCustomizations,
        ambientKey: defaultAmbientKey,
        languageId,
        title,
      } satisfies StoredComposition))
    } catch {
      // The default ambient still loads when local persistence is unavailable.
    }
    navigate('/')
  }

  const getAmbientActions = (): AmbientToolbarActionState => {
    if (sharedDefinition && !sharedAmbient?.isOwnedByViewer) {
      return { kind: 'shared', isCopying: isCreatingTheme, onCopy: startAmbient }
    }
    if (!selectedOwnedAmbient) return { kind: 'none' }
    return {
      kind: 'owned',
      ambient: selectedOwnedAmbient,
      onCopyLink: (ambient) => {
        if (ambient.shareId) void copyAmbientShareLink(ambient.shareId, ambient.slug, 'editor')
      },
      onEdit: openWorkspace,
    }
  }
  const ambientActions = getAmbientActions()

  return (
    <main className="app-shell">
      <h1 className="sr-only">codeshot.dev code screenshot tool</h1>
      <SiteHeader
        account={snapshot.account}
        isHydrated={snapshot.isHydrated}
        draftCount={draftCount}
        onOpenLibrary={openLibrary}
        onOpenAdmin={openAdmin}
        onSignIn={service.signIn}
        onSignOut={signOut}
      />
      <section className="workspace" aria-label="Editable screenshot">
        <ScreenshotPreview
          ambientKey={selectedAmbientKey}
          definitions={definitions}
          yourAmbients={yourAmbients}
          isCreatingTheme={isCreatingTheme}
          onAmbientPickerOpenChange={() => undefined}
          onAmbientChange={setAmbientKey}
          onCreateTheme={startAmbient}
          onExitSharedAmbient={sharedDefinition ? exitSharedAmbient : undefined}
          ambientActions={ambientActions}
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
      <Toaster />
    </main>
  )
}
