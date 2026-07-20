import {
  Component,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { config } from 'wasp/client'
import { useParams } from 'react-router'
import { AmbientMark } from '../ambient-mark'
import { loadAmbientDefinition } from '../ambient-registry'
import {
  resolveAmbientVariables,
  type AmbientDefinition,
  type ScreenshotContent,
} from '../ambient-themes'
import { DeclarativeAmbient } from '../declarative-ambient'
import { EditorSkeleton } from '../editor-skeleton'
import { defaultCode, useCodeEditor } from '../use-code-editor'
import type { AgentDraftDto } from './contracts'
import '../index.css'
import './agent-preview-page.css'

type DeclarativeAmbientDefinition = Extract<AmbientDefinition, { kind: 'declarative' }>

const rasterDataUrlPattern = /data:image\/(?:png|jpeg);base64,[a-z0-9+/]+={0,2}/gi

const preflightRasterAssets = async (document: AgentDraftDto['document']) => {
  const urls = new Set([
    ...(document.stylesheet.match(rasterDataUrlPattern) ?? []),
    ...(document.thumbnail.stylesheet.match(rasterDataUrlPattern) ?? []),
  ])
  await Promise.all([...urls].map(async (url) => {
    const image = new Image()
    image.src = url
    await image.decode()
  }))
}

class PreviewErrorBoundary extends Component<
  { children: ReactNode; onError: (message: string) => void },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onError(error.message)
  }

  render() {
    return this.state.hasError ? null : this.props.children
  }
}

export function AgentPreviewCanvas({
  definition,
  onError,
  onReady,
}: {
  definition: DeclarativeAmbientDefinition
  onError?: (message: string) => void
  onReady?: () => void
}) {
  const editorHelpId = 'agent-preview-editor-help'
  const previewRef = useRef<HTMLElement>(null)
  const {
    code,
    editorHostRef,
    isEditorReady,
    selectedLanguage,
  } = useCodeEditor({
    languageId: 'typescript',
    ambientEditorExtension: definition.editorExtension,
    ariaDescribedBy: editorHelpId,
    initialCode: defaultCode,
    persistCode: false,
  })
  const content: ScreenshotContent = {
    title: 'Agent preview',
    fileType: {
      id: selectedLanguage.id,
      label: selectedLanguage.label,
      syntax: selectedLanguage.lang,
    },
    lineCount: code.split('\n').length,
  }
  const frameStyle = {
    ...resolveAmbientVariables(definition, {}),
    '--annotation-ink': definition.manifest.annotations.ink,
  } as CSSProperties

  useEffect(() => {
    if (!isEditorReady) return
    const frame = window.requestAnimationFrame(() => {
      const ambientReady = Boolean(previewRef.current?.querySelector('.declarative-ambient')?.shadowRoot)
      const thumbnailReady = Boolean(previewRef.current?.querySelector('.ambient-mark')?.shadowRoot)
      if (ambientReady && thumbnailReady) onReady?.()
      else onError?.('The ambient or thumbnail renderer did not initialize.')
    })
    return () => window.cancelAnimationFrame(frame)
  }, [isEditorReady, onError, onReady])

  return (
    <main className="agent-preview-page" ref={previewRef}>
      <section className="agent-preview-section" aria-labelledby="full-preview-title">
        <h1 id="full-preview-title">Full ambient</h1>
        <div className="agent-preview-frame-wrap">
          <div
            className="shot-frame agent-preview-frame"
            data-export-gutter={definition.manifest.editor.exportGutter}
            style={frameStyle}
          >
            <DeclarativeAmbient
              compiledDocument={definition.compiledDocument}
              content={content}
              style={frameStyle}
            >
              <div ref={editorHostRef} className="code-editor-host" slot="code">
                {!isEditorReady && <EditorSkeleton />}
              </div>
            </DeclarativeAmbient>
          </div>
        </div>
        <p id={editorHelpId} className="sr-only">Editable code preview</p>
      </section>

      <section className="agent-preview-section" aria-labelledby="thumbnail-preview-title">
        <h2 id="thumbnail-preview-title">Picker thumbnail / 6x</h2>
        <div className="agent-preview-thumbnail-stage">
          <AmbientMark definition={definition} />
        </div>
      </section>
    </main>
  )
}

export function AgentPreviewPage() {
  const { capability } = useParams<'capability'>()
  const [definition, setDefinition] = useState<DeclarativeAmbientDefinition | null>(null)
  const [error, setError] = useState('')
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const reportError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const reason = 'reason' in event ? event.reason : event.error ?? event.message
      setError(reason instanceof Error ? reason.message : String(reason || 'Browser rendering failed.'))
    }
    window.addEventListener('error', reportError)
    window.addEventListener('unhandledrejection', reportError)
    return () => {
      window.removeEventListener('error', reportError)
      window.removeEventListener('unhandledrejection', reportError)
    }
  }, [])

  useEffect(() => {
    setDefinition(null)
    setError('')
    setIsReady(false)

    if (!capability) {
      setError('Preview link is invalid.')
      return
    }

    const controller = new AbortController()
    const loadPreview = async () => {
      try {
        const response = await fetch(
          `${config.apiUrl}/agent/sessions/${encodeURIComponent(capability)}/draft`,
          { signal: controller.signal },
        )
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { message?: string } | null
          throw new Error(body?.message ?? 'Preview is unavailable or expired.')
        }
        const draft = await response.json() as AgentDraftDto
        await preflightRasterAssets(draft.document)
        if (controller.signal.aborted) return
        const result = loadAmbientDefinition({
          id: draft.ambientId,
          version: draft.revision,
          document: draft.document,
        }, 'draft')
        if (!result.definition || result.definition.kind !== 'declarative') {
          const details = result.diagnostics
            .map((diagnostic) => `${diagnostic.code}${diagnostic.path ? ` ${diagnostic.path}` : ''}: ${diagnostic.message}`)
            .join('\n')
          throw new Error(details || 'Preview document is invalid.')
        }
        if (controller.signal.aborted) return
        setDefinition(result.definition)
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : 'Preview is unavailable.')
        }
      }
    }

    loadPreview()
    return () => controller.abort()
  }, [capability])

  const content = error
    ? <main className="agent-preview-status" data-preview-state="error">{error}</main>
    : definition
      ? (
          <div data-preview-state={isReady ? 'ready' : 'rendering'}>
            <PreviewErrorBoundary key={capability} onError={setError}>
              <AgentPreviewCanvas
                definition={definition}
                onError={setError}
                onReady={() => setIsReady(true)}
              />
            </PreviewErrorBoundary>
          </div>
        )
      : <main className="agent-preview-status" data-preview-state="loading">Loading preview...</main>

  return (
    <>
      <title>Ambient preview | codeshot.dev</title>
      <meta name="robots" content="noindex, nofollow" />
      <meta name="referrer" content="no-referrer" />
      {content}
    </>
  )
}
