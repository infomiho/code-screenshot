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
import { AmbientSelector } from './ambient-selector'
import { DeclarativeAmbient } from './declarative-ambient'
import { renderScreenshotBlob } from './screenshot-export'
import {
  ambientDefinitions,
  type AmbientDefinition,
  type ScreenshotContent,
} from './ambient-themes'

type ExportAction = 'copy' | 'download' | null

type ScreenshotPreviewProps = {
  ambientKey: string
  onAmbientChange: (ambientKey: string) => void
  selectedAmbient: AmbientDefinition
  screenshotContent: ScreenshotContent
  ambientVariables: CSSProperties
  editorHostRef: RefCallback<HTMLDivElement>
  editorHelpId: string
}

const minFrameWidth = 420
const maxFrameWidth = 1280
const defaultFrameWidth = 860
const frameWidthKeyStep = 20

const clampFrameWidth = (width: number) =>
  Math.min(maxFrameWidth, Math.max(minFrameWidth, Math.round(width)))

const penStrokeOptions = {
  size: 6,
  thinning: 0,
  smoothing: 0.8,
  streamline: 0.7,
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

const smoothPenPoints = (points: number[][], passes = 3) => {
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
  onAmbientChange,
  selectedAmbient,
  screenshotContent,
  ambientVariables,
  editorHostRef,
  editorHelpId,
}: ScreenshotPreviewProps) {
  const shotRef = useRef<HTMLDivElement>(null)
  const previewViewportRef = useRef<HTMLDivElement>(null)
  const widthDragRef = useRef<{ startX: number; startWidth: number; scale: number } | null>(null)
  const activePenPointsRef = useRef<number[][] | null>(null)
  const [frameWidth, setFrameWidth] = useState(defaultFrameWidth)
  const [previewScale, setPreviewScale] = useState(1)
  const [exportAction, setExportAction] = useState<ExportAction>(null)
  const [message, setMessage] = useState('')
  const [isPenActive, setIsPenActive] = useState(false)
  const [penStrokes, setPenStrokes] = useState<number[][][]>([])
  const [, setPenTick] = useState(0)
  const isCopying = exportAction === 'copy'
  const isDownloading = exportAction === 'download'
  const isExporting = exportAction !== null
  const frameClass = selectedAmbient.kind === 'react'
    ? `shot-frame ${selectedAmbient.frameClass}`
    : 'shot-frame'
  const frameStyle = {
    width: `${frameWidth}px`,
    '--annotation-ink': selectedAmbient.manifest.annotations.ink,
    ...(selectedAmbient.kind === 'react' ? ambientVariables : {}),
  } as CSSProperties

  const renderAmbient = () => {
    if (selectedAmbient.kind === 'declarative') {
      return (
        <DeclarativeAmbient
          compiledDocument={selectedAmbient.compiledDocument}
          content={screenshotContent}
          style={ambientVariables}
        >
          <div ref={editorHostRef} className="code-editor-host" slot="code" />
        </DeclarativeAmbient>
      )
    }

    const SelectedAmbientShell = selectedAmbient.Shell
    return (
      <SelectedAmbientShell content={screenshotContent}>
        <div ref={editorHostRef} className="code-editor-host" />
      </SelectedAmbientShell>
    )
  }

  useEffect(() => {
    if (!message) return

    const timer = window.setTimeout(() => setMessage(''), 4000)
    return () => window.clearTimeout(timer)
  }, [message])

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

  const getPenPoint = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return [
      (event.clientX - bounds.left) / previewScale,
      (event.clientY - bounds.top) / previewScale,
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
    widthDragRef.current = { startX: event.clientX, startWidth: frameWidth, scale: previewScale }
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
    setMessage('')

    try {
      const blob = await renderPngBlob()
      if (!blob) return

      if (!navigator.clipboard || !window.ClipboardItem) {
        setMessage('Clipboard unavailable. Use Download PNG.')
        return
      }

      await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })])
      setMessage('Copied PNG to clipboard.')
    } catch {
      setMessage('Copy failed. Use Download PNG.')
    } finally {
      setExportAction(null)
    }
  }

  const downloadPng = async () => {
    setExportAction('download')
    setMessage('')

    try {
      const blob = await renderPngBlob()
      if (!blob) return

      downloadBlob(blob)
      setMessage('Downloaded PNG.')
    } catch {
      setMessage('Download failed.')
    } finally {
      setExportAction(null)
    }
  }

  return (
    <div className="preview-viewport" ref={previewViewportRef}>
      <div className="preview-stage">
        <div className="stage-cluster">
          <div className="shot-toolbar">
            <div className="toolbar-group toolbar-export">
              <button
                className="pen-button pen-button-primary"
                type="button"
                onClick={copyPng}
                disabled={isExporting}
              >
                {isCopying ? 'Copying...' : 'Copy PNG'}
              </button>
              <button
                className="pen-button"
                type="button"
                onClick={downloadPng}
                disabled={isExporting}
              >
                {isDownloading ? 'Downloading...' : 'Download PNG'}
              </button>
              <span id="export-status" className="toolbar-status" role="status" aria-live="polite">
                {message}
              </span>
            </div>
            <AmbientSelector
              definitions={ambientDefinitions}
              selectedKey={ambientKey}
              onSelect={onAmbientChange}
            />
            <div className="toolbar-group toolbar-draw">
              {penStrokes.length > 0 && (
                <>
                  <button
                    className="pen-button"
                    type="button"
                    onClick={() => setPenStrokes((previousStrokes) => previousStrokes.slice(0, -1))}
                  >
                    <svg className="pen-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M9 14 4 9l5-5" />
                      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
                    </svg>
                    Undo
                  </button>
                  <button className="pen-button" type="button" onClick={() => setPenStrokes([])}>
                    <svg className="pen-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                    Clear
                  </button>
                </>
              )}
              <button
                className={isPenActive ? 'pen-button pen-button-active' : 'pen-button'}
                type="button"
                aria-pressed={isPenActive}
                onClick={() => setIsPenActive((active) => !active)}
              >
                <svg className="pen-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                {isPenActive ? 'Drawing' : 'Draw'}
              </button>
            </div>
          </div>
          <div style={previewScale < 1 ? { zoom: previewScale } : undefined}>
            <div
              ref={shotRef}
              className={frameClass}
              data-export-gutter={selectedAmbient.manifest.editor.exportGutter}
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
            Edit or paste code. Click line numbers to highlight. Shift-click or drag for ranges.
            Toggle Draw to sketch on top.
          </p>
        </div>
      </div>
    </div>
  )
}
