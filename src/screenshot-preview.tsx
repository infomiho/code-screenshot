import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefCallback,
} from 'react'
import { getStroke } from 'perfect-freehand'
import { IconArrowBackUp, IconPencil, IconX } from '@tabler/icons-react'
import { AmbientSelector, type YourAmbientsState } from './ambient-selector'
import { AmbientSkeleton } from './ambient-skeleton'
import { DeclarativeAmbient } from './declarative-ambient'
import { EditorSkeleton } from './editor-skeleton'
import { renderScreenshotBlob } from './screenshot-export'
import { toastManager } from './toast'
import { type AmbientDefinition, type ScreenshotContent } from './ambient-themes'

type ExportAction = 'copy' | 'download' | null
type PreviewMode = 'fit' | 'edit'

type ScreenshotPreviewProps = {
  ambientKey: string
  definitions: readonly AmbientDefinition[]
  yourAmbients: YourAmbientsState
  onAmbientPickerOpenChange: (isOpen: boolean) => void
  onAmbientChange: (ambientKey: string) => void
  onExitSharedAmbient?: () => void
  selectedAmbient: AmbientDefinition
  screenshotContent: ScreenshotContent
  ambientVariables: CSSProperties
  editorHostRef: RefCallback<HTMLDivElement>
  editorHelpId: string
  isEditorReady: boolean
  isFrameReady: boolean
}

const minFrameWidth = 420
const maxFrameWidth = 1280
const defaultFrameWidth = 860
const frameWidthKeyStep = 20
// Matches --skeleton-reveal-duration; the reveal fades in once, never on later ambient switches.
const frameRevealDurationMs = 240
const minEditablePreviewScale = 0.65
const previewStateStorageKey = 'codeshot.preview-composition'

type StoredPreviewState = {
  frameWidth: number
  penStrokes: number[][][]
}

const readStoredPreviewState = (): StoredPreviewState | null => {
  try {
    const value = globalThis.localStorage?.getItem(previewStateStorageKey)
    return value ? JSON.parse(value) as StoredPreviewState : null
  } catch {
    return null
  }
}

const clampFrameWidth = (width: number) =>
  Math.min(maxFrameWidth, Math.max(minFrameWidth, Math.round(width)))

const penStrokeOptions = {
  size: 6,
  thinning: 0,
  smoothing: 0.55,
  streamline: 0.5,
  simulatePressure: false,
}

const average = (a: number, b: number) => (a + b) / 2

const getSvgPathFromStroke = (points: number[][]) => {
  const len = points.length
  if (len < 4) return ''

  let a = points[0]
  let b = points[1]
  const c = points[2]
  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(b[1], c[1]).toFixed(2)} T`

  for (let i = 2, max = len - 1; i < max; i += 1) {
    a = points[i]
    b = points[i + 1]
    result += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(2)} `
  }

  return `${result}Z`
}

const getPenStrokePath = (points: number[][]) =>
  getSvgPathFromStroke(getStroke(points, penStrokeOptions))

const cornerTurnCosine = Math.cos((65 * Math.PI) / 180)

const findPenCorners = (points: number[][]) => {
  const corners = new Set<number>()

  for (let i = 2; i < points.length - 2; i += 1) {
    const v1x = points[i][0] - points[i - 2][0]
    const v1y = points[i][1] - points[i - 2][1]
    const v2x = points[i + 2][0] - points[i][0]
    const v2y = points[i + 2][1] - points[i][1]
    const l1 = Math.hypot(v1x, v1y)
    const l2 = Math.hypot(v2x, v2y)

    if (l1 < 1 || l2 < 1) continue
    if ((v1x * v2x + v1y * v2y) / (l1 * l2) < cornerTurnCosine) corners.add(i)
  }

  return corners
}

const smoothPenPoints = (points: number[][], passes = 2) => {
  if (points.length < 5) return points

  const anchors = findPenCorners(points)
  const halfWindow = Math.min(4, Math.floor(points.length / 4))
  let smoothed = points

  for (let pass = 0; pass < passes; pass += 1) {
    smoothed = smoothed.map((point, index, all) => {
      if (index === 0 || index === all.length - 1 || anchors.has(index)) return point

      const start = Math.max(0, index - halfWindow)
      const end = Math.min(all.length - 1, index + halfWindow)
      let sumX = 0
      let sumY = 0

      for (let i = start; i <= end; i += 1) {
        sumX += all[i][0]
        sumY += all[i][1]
      }

      const count = end - start + 1
      return [sumX / count, sumY / count, point[2]]
    })
  }

  return smoothed
}

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
  onAmbientPickerOpenChange,
  onAmbientChange,
  onExitSharedAmbient,
  selectedAmbient,
  screenshotContent,
  ambientVariables,
  editorHostRef,
  editorHelpId,
  isEditorReady,
  isFrameReady,
}: ScreenshotPreviewProps) {
  const [storedPreviewState] = useState(readStoredPreviewState)
  const [isFrameRevealed, setIsFrameRevealed] = useState(false)
  const hasStartedRevealRef = useRef(false)
  const shotRef = useRef<HTMLDivElement>(null)
  const previewViewportRef = useRef<HTMLDivElement>(null)
  const widthDragRef = useRef<{ startX: number; startWidth: number; scale: number } | null>(null)
  const activePenPointsRef = useRef<number[][] | null>(null)
  const [frameWidth, setFrameWidth] = useState(
    () => clampFrameWidth(storedPreviewState?.frameWidth ?? defaultFrameWidth),
  )
  const [previewScale, setPreviewScale] = useState(1)
  const [previewMode, setPreviewMode] = useState<PreviewMode>('fit')
  const [exportAction, setExportAction] = useState<ExportAction>(null)
  const [isPenActive, setIsPenActive] = useState(false)
  const [penStrokes, setPenStrokes] = useState<number[][][]>(storedPreviewState?.penStrokes ?? [])
  const [, setPenTick] = useState(0)
  const isCopying = exportAction === 'copy'
  const isDownloading = exportAction === 'download'
  const isExporting = exportAction !== null
  const renderedPreviewScale = previewMode === 'edit'
    ? Math.max(previewScale, minEditablePreviewScale)
    : previewScale
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

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(previewStateStorageKey, JSON.stringify({ frameWidth, penStrokes }))
    } catch {
      // Export and editing do not depend on local persistence.
    }
  }, [frameWidth, penStrokes])

  useEffect(() => {
    const viewport = previewViewportRef.current
    const frame = shotRef.current
    if (!viewport || !frame) return

    const updateScale = () => {
      const availableWidth = viewport.clientWidth - 40
      setPreviewScale(Math.min(1, availableWidth / frame.offsetWidth))
    }

    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(viewport)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const compactViewport = window.matchMedia('(max-width: 720px)')
    const resetDesktopMode = () => {
      if (!compactViewport.matches) setPreviewMode('fit')
    }

    compactViewport.addEventListener('change', resetDesktopMode)
    return () => compactViewport.removeEventListener('change', resetDesktopMode)
  }, [])

  useEffect(() => {
    if (previewMode === 'fit' && previewViewportRef.current) {
      previewViewportRef.current.scrollLeft = 0
    }
  }, [previewMode])

  const getPenPoint = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return [
      (event.clientX - bounds.left) / renderedPreviewScale,
      (event.clientY - bounds.top) / renderedPreviewScale,
      event.pressure,
    ]
  }

  const startPenStroke = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    activePenPointsRef.current = [getPenPoint(event)]
    setPenTick((tick) => tick + 1)
  }

  const extendPenStroke = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!activePenPointsRef.current || event.buttons !== 1) return

    activePenPointsRef.current.push(getPenPoint(event))
    setPenTick((tick) => tick + 1)
  }

  const endPenStroke = () => {
    const points = activePenPointsRef.current
    activePenPointsRef.current = null

    if (points && points.length > 1) {
      setPenStrokes((previousStrokes) => [...previousStrokes, smoothPenPoints(points)])
    } else {
      setPenTick((tick) => tick + 1)
    }
  }

  const startWidthDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    widthDragRef.current = {
      startX: event.clientX,
      startWidth: frameWidth,
      scale: renderedPreviewScale,
    }
  }

  const moveWidthDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = widthDragRef.current
    if (!drag) return

    const widthDelta = ((event.clientX - drag.startX) * 2) / drag.scale
    setFrameWidth(clampFrameWidth(drag.startWidth + widthDelta))
  }

  const endWidthDrag = () => {
    widthDragRef.current = null
  }

  const nudgeFrameWidth = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

    event.preventDefault()
    const step = event.key === 'ArrowRight' ? frameWidthKeyStep : -frameWidthKeyStep
    setFrameWidth((previousWidth) => clampFrameWidth(previousWidth + step))
  }

  const renderPngBlob = async () => {
    const frame = shotRef.current
    if (!frame) return null
    return renderScreenshotBlob(frame)
  }

  const copyPng = async () => {
    setExportAction('copy')

    try {
      const blob = await renderPngBlob()
      if (!blob) return

      if (!navigator.clipboard || !window.ClipboardItem) {
        toastManager.add({ description: 'Clipboard unavailable. Use Download PNG.' })
        return
      }

      await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })])
      toastManager.add({ description: 'Copied PNG to clipboard.' })
    } catch {
      toastManager.add({ description: 'Copy failed. Use Download PNG.', priority: 'high' })
    } finally {
      setExportAction(null)
    }
  }

  const downloadPng = async () => {
    setExportAction('download')

    try {
      const blob = await renderPngBlob()
      if (!blob) return

      downloadBlob(blob)
      toastManager.add({ description: 'Downloaded PNG.' })
    } catch {
      toastManager.add({ description: 'Download failed.', priority: 'high' })
    } finally {
      setExportAction(null)
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
                disabled={isExporting}
              >
                {isCopying ? 'Copying...' : 'Copy PNG'}
              </button>
              <button
                className="ui-button toolbar-button"
                type="button"
                onClick={downloadPng}
                disabled={isExporting}
              >
                {isDownloading ? 'Downloading...' : 'Download PNG'}
              </button>
            </div>
            <AmbientSelector
              definitions={definitions}
              selectedKey={ambientKey}
              yourAmbients={yourAmbients}
              onOpenChange={onAmbientPickerOpenChange}
              onSelect={onAmbientChange}
              onExitSharedAmbient={onExitSharedAmbient}
            />
            <div className="toolbar-group toolbar-draw">
              {penStrokes.length > 0 && (
                <>
                  <button
                    className="ui-button toolbar-button"
                    type="button"
                    onClick={() => setPenStrokes((previousStrokes) => previousStrokes.slice(0, -1))}
                  >
                    <IconArrowBackUp className="pen-icon" aria-hidden="true" />
                    Undo
                  </button>
                  <button className="ui-button toolbar-button" type="button" onClick={() => setPenStrokes([])}>
                    <IconX className="pen-icon" aria-hidden="true" />
                    Clear
                  </button>
                </>
              )}
              <button
                className="ui-button toolbar-button"
                type="button"
                aria-pressed={isPenActive}
                onClick={() => setIsPenActive((active) => !active)}
              >
                <IconPencil className="pen-icon" aria-hidden="true" />
                {isPenActive ? 'Drawing' : 'Draw'}
              </button>
            </div>
            <div className="preview-mode-switch" role="group" aria-label="Preview size">
              <button
                className="ui-button"
                type="button"
                aria-pressed={previewMode === 'fit'}
                onClick={() => setPreviewMode('fit')}
              >
                Fit
              </button>
              <button
                className="ui-button"
                type="button"
                aria-pressed={previewMode === 'edit'}
                onClick={() => setPreviewMode('edit')}
              >
                Edit
              </button>
            </div>
          </div>
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
                aria-valuemin={minFrameWidth}
                aria-valuemax={maxFrameWidth}
                aria-valuenow={frameWidth}
                tabIndex={0}
                title="Drag to resize. Double-click to reset."
                onPointerDown={startWidthDrag}
                onPointerMove={moveWidthDrag}
                onPointerUp={endWidthDrag}
                onPointerCancel={endWidthDrag}
                onDoubleClick={() => setFrameWidth(defaultFrameWidth)}
                onKeyDown={nudgeFrameWidth}
              />
              {(isPenActive || penStrokes.length > 0) && (
                <svg
                  className={isPenActive ? 'draw-layer draw-layer-active' : 'draw-layer'}
                  aria-hidden="true"
                  onPointerDown={isPenActive ? startPenStroke : undefined}
                  onPointerMove={isPenActive ? extendPenStroke : undefined}
                  onPointerUp={isPenActive ? endPenStroke : undefined}
                  onPointerCancel={isPenActive ? endPenStroke : undefined}
                >
                  {penStrokes.map((strokePoints, index) => (
                    <path key={index} d={getPenStrokePath(strokePoints)} />
                  ))}
                  {activePenPointsRef.current && (
                    <path d={getPenStrokePath(activePenPointsRef.current)} />
                  )}
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
