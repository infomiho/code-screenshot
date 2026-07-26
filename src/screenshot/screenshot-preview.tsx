import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefCallback,
} from 'react'
import { IconArrowBackUp, IconPencil, IconX } from '@tabler/icons-react'
import { AmbientSelector, type YourAmbientsState } from '../ambient/selection/ambient-selector'
import { AmbientSkeleton } from './ambient-skeleton'
import { DeclarativeAmbient } from '../ambient/rendering/declarative-ambient'
import { EditorSkeleton } from './editor-skeleton'
import { renderScreenshotBlob } from './screenshot-export'
import { toastManager } from '../ui/toast'
import { type AmbientDefinition, type ScreenshotContent } from '../ambient/rendering/ambient-themes'
import { usePenDrawing } from './use-pen-drawing'
import { usePreviewFrame } from './use-preview-frame'
import {
  editorThemeNudgeSentences,
  sharedThemeNudgeSentences,
  ThemeNudge,
} from './theme-nudge'
import './preview-frame.css'
import { trackProductEvent } from '../product-metrics/events'
import { getAnalyticsSurface } from '../product-metrics/metrics-client'
import { useCopyFeedback } from '../ui/use-copy-feedback'
import { CopyFeedbackLabel } from '../ui/copy-feedback-label'

type ScreenshotPreviewProps = {
  ambientKey: string
  definitions: readonly AmbientDefinition[]
  yourAmbients: YourAmbientsState
  isCreatingTheme: boolean
  onAmbientPickerOpenChange: (isOpen: boolean) => void
  onAmbientChange: (ambientKey: string) => void
  onCreateTheme: () => void
  onExitSharedAmbient?: () => void
  selectedAmbient: AmbientDefinition
  screenshotContent: ScreenshotContent
  ambientVariables: CSSProperties
  editorHostRef: RefCallback<HTMLDivElement>
  editorHelpId: string
  isEditorReady: boolean
  isFrameReady: boolean
}

// Matches --skeleton-reveal-duration; the reveal fades in once, never on later ambient switches.
const frameRevealDurationMs = 240

const downloadBlob = (blob: Blob) => {
  const link = document.createElement('a')
  const url = window.URL.createObjectURL(blob)

  link.download = 'code-screenshot.png'
  link.href = url
  link.click()
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0)
}

export function ScreenshotPreview({
  ambientKey,
  definitions,
  yourAmbients,
  isCreatingTheme,
  onAmbientPickerOpenChange,
  onAmbientChange,
  onCreateTheme,
  onExitSharedAmbient,
  selectedAmbient,
  screenshotContent,
  ambientVariables,
  editorHostRef,
  editorHelpId,
  isEditorReady,
  isFrameReady,
}: ScreenshotPreviewProps) {
  const [isFrameRevealed, setIsFrameRevealed] = useState(false)
  const hasStartedRevealRef = useRef(false)
  const copyInFlightRef = useRef(false)
  const downloadInFlightRef = useRef(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const copyFeedback = useCopyFeedback()
  const {
    frameWidth,
    previewMode,
    renderedPreviewScale,
    shotRef,
    previewViewportRef,
    resizeHandleProps,
    showFittedPreview,
    showEditablePreview,
  } = usePreviewFrame()
  const {
    isDrawing,
    hasDrawing,
    strokePaths,
    activeStrokePath,
    drawingPointerHandlers,
    toggleDrawing,
    undoLastStroke,
    clearDrawing,
  } = usePenDrawing(renderedPreviewScale)
  const frameStatus = !isFrameReady ? 'resolving' : isFrameRevealed ? 'ready' : 'revealing'
  const isThemedFrame = isFrameReady && selectedAmbient.kind === 'react'
  const frameClass = isThemedFrame
    ? `shot-frame ${selectedAmbient.frameClass}`
    : 'shot-frame'
  const frameStyle = {
    width: `${frameWidth}px`,
    '--annotation-ink': selectedAmbient.manifest.annotations.ink,
    ...(isThemedFrame ? ambientVariables : {}),
  } as CSSProperties

  const renderAmbient = () => {
    if (!isFrameReady) return <AmbientSkeleton />

    const editorSkeleton = !isEditorReady && <EditorSkeleton />

    if (selectedAmbient.kind === 'declarative') {
      return (
        <DeclarativeAmbient
          compiledDocument={selectedAmbient.compiledDocument}
          content={screenshotContent}
          style={ambientVariables}
        >
          <div ref={editorHostRef} className="code-editor-host" slot="code">
            {editorSkeleton}
          </div>
        </DeclarativeAmbient>
      )
    }

    const SelectedAmbientShell = selectedAmbient.Shell
    return (
      <SelectedAmbientShell content={screenshotContent}>
        <div ref={editorHostRef} className="code-editor-host">
          {editorSkeleton}
        </div>
      </SelectedAmbientShell>
    )
  }

  useEffect(() => {
    if (!isFrameReady || hasStartedRevealRef.current) return
    hasStartedRevealRef.current = true
    const timer = window.setTimeout(() => setIsFrameRevealed(true), frameRevealDurationMs)
    return () => window.clearTimeout(timer)
  }, [isFrameReady])

  const renderPngBlob = async () => {
    const frame = shotRef.current
    if (!frame) return null
    return renderScreenshotBlob(frame)
  }

  const copyPng = async () => {
    if (copyInFlightRef.current) return
    copyInFlightRef.current = true

    try {
      const blob = await renderPngBlob()
      if (!blob) return

      if (!navigator.clipboard || !window.ClipboardItem) {
        toastManager.add({ description: 'Clipboard unavailable. Use Download PNG.', priority: 'high' })
        return
      }

      await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })])
      trackProductEvent('Screenshot Copied', {
        surface: getAnalyticsSurface(),
        ambient_source: selectedAmbient.source,
      })
      copyFeedback.showCopied()
    } catch {
      toastManager.add({ description: 'Copy failed. Use Download PNG.', priority: 'high' })
    } finally {
      copyInFlightRef.current = false
    }
  }

  const downloadPng = async () => {
    if (downloadInFlightRef.current) return
    downloadInFlightRef.current = true
    setIsDownloading(true)

    try {
      const blob = await renderPngBlob()
      if (!blob) return

      downloadBlob(blob)
      trackProductEvent('Screenshot Downloaded', {
        surface: getAnalyticsSurface(),
        ambient_source: selectedAmbient.source,
      })
    } catch {
      toastManager.add({ description: 'Download failed.', priority: 'high' })
    } finally {
      downloadInFlightRef.current = false
      setIsDownloading(false)
    }
  }

  return (
    <div className="preview-viewport" data-preview-mode={previewMode} ref={previewViewportRef}>
      <div className="preview-stage">
        <div className="stage-cluster">
          <div className="shot-toolbar">
            <div className="toolbar-group toolbar-export">
              <button
                className="ui-button ui-button-primary toolbar-button"
                type="button"
                onClick={copyPng}
              >
                <CopyFeedbackLabel isCopied={copyFeedback.isCopied}>Copy PNG</CopyFeedbackLabel>
              </button>
              <button
                className="ui-button toolbar-button"
                type="button"
                onClick={downloadPng}
                disabled={isDownloading}
              >
                {isDownloading ? 'Downloading...' : 'Download PNG'}
              </button>
            </div>
            <AmbientSelector
              definitions={definitions}
              selectedKey={ambientKey}
              yourAmbients={yourAmbients}
              isCreatingTheme={isCreatingTheme}
              onOpenChange={onAmbientPickerOpenChange}
              onCreateTheme={onCreateTheme}
              onSelect={onAmbientChange}
              onExitSharedAmbient={onExitSharedAmbient}
            />
            <div className="toolbar-group toolbar-draw">
              {hasDrawing && (
                <>
                  <button
                    className="ui-button toolbar-button"
                    type="button"
                    onClick={undoLastStroke}
                  >
                    <IconArrowBackUp className="pen-icon" aria-hidden="true" />
                    Undo
                  </button>
                  <button className="ui-button toolbar-button" type="button" onClick={clearDrawing}>
                    <IconX className="pen-icon" aria-hidden="true" />
                    Clear
                  </button>
                </>
              )}
              <button
                className="ui-button toolbar-button"
                type="button"
                aria-pressed={isDrawing}
                onClick={toggleDrawing}
              >
                <IconPencil className="pen-icon" aria-hidden="true" />
                {isDrawing ? 'Drawing' : 'Draw'}
              </button>
            </div>
            <div className="preview-mode-switch" role="group" aria-label="Preview size">
              <button
                className="ui-button"
                type="button"
                aria-pressed={previewMode === 'fit'}
                onClick={showFittedPreview}
              >
                Fit
              </button>
              <button
                className="ui-button"
                type="button"
                aria-pressed={previewMode === 'edit'}
                onClick={showEditablePreview}
              >
                Edit
              </button>
            </div>
          </div>
          <ThemeNudge
            isCreatingTheme={isCreatingTheme}
            onCreateTheme={onCreateTheme}
            sentences={onExitSharedAmbient ? sharedThemeNudgeSentences : editorThemeNudgeSentences}
          />
          <div style={renderedPreviewScale < 1 ? { zoom: renderedPreviewScale } : undefined}>
            <div
              ref={shotRef}
              className={frameClass}
              data-export-gutter={selectedAmbient.manifest.editor.exportGutter}
              data-frame-status={frameStatus}
              style={frameStyle}
            >
              {renderAmbient()}
              <div
                className="width-handle"
                role="separator"
                aria-orientation="vertical"
                aria-label="Frame width"
                tabIndex={0}
                title="Drag to resize. Double-click to reset."
                {...resizeHandleProps}
              />
              {(isDrawing || hasDrawing) && (
                <svg
                  className={isDrawing ? 'draw-layer draw-layer-active' : 'draw-layer'}
                  aria-hidden="true"
                  {...drawingPointerHandlers}
                >
                  {strokePaths.map((path, index) => (
                    <path key={index} d={path} />
                  ))}
                  {activeStrokePath !== null && <path d={activeStrokePath} />}
                </svg>
              )}
            </div>
          </div>

          <p id={editorHelpId} className="editor-help">
            <span className="editor-help-desktop">
              Edit or paste code. Click line numbers to highlight. Shift-click or drag for ranges.
              Toggle Draw to sketch on top.
            </span>
            <span className="editor-help-touch">
              Tap code to edit. Tap line numbers to highlight. Draw to annotate.
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
