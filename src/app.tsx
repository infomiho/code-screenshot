import { useEffect, useRef, useState } from 'preact/hooks'
import { minimalSetup } from 'codemirror'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import {
  EditorState,
  RangeSet,
  RangeSetBuilder,
  StateEffect,
  StateField,
  type Extension,
} from '@codemirror/state'
import {
  Decoration,
  EditorView,
  GutterMarker,
  keymap,
  lineNumberMarkers,
  lineNumbers,
  placeholder,
  type DecorationSet,
} from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { tags } from '@lezer/highlight'
import { domToBlob } from 'modern-screenshot'
import { getStroke } from 'perfect-freehand'

type HighlightLanguage =
  | 'bash'
  | 'css'
  | 'html'
  | 'javascript'
  | 'json'
  | 'jsx'
  | 'markdown'
  | 'python'
  | 'tsx'
  | 'typescript'

type LanguageValue = HighlightLanguage | 'text'

type LanguageOption = {
  id: string
  label: string
  lang: LanguageValue
}

type LineDragMode = 'add' | 'remove'
type ExportAction = 'copy' | 'download' | null

const languageOptions: LanguageOption[] = [
  { id: 'typescript', label: 'TypeScript', lang: 'typescript' },
  { id: 'wasp', label: 'Wasp', lang: 'typescript' },
  { id: 'tsx', label: 'TSX', lang: 'tsx' },
  { id: 'javascript', label: 'JavaScript', lang: 'javascript' },
  { id: 'jsx', label: 'JSX', lang: 'jsx' },
  { id: 'json', label: 'JSON', lang: 'json' },
  { id: 'css', label: 'CSS', lang: 'css' },
  { id: 'html', label: 'HTML', lang: 'html' },
  { id: 'bash', label: 'Bash', lang: 'bash' },
  { id: 'python', label: 'Python', lang: 'python' },
  { id: 'markdown', label: 'Markdown', lang: 'markdown' },
  { id: 'text', label: 'Plain text', lang: 'text' },
]

const backgroundOptions = [
  { id: 'yellow', label: 'Wasp yellow', value: '#f5c842' },
  {
    id: 'wasp-glow',
    label: 'Wasp glow',
    value: 'radial-gradient(circle at 28% 20%, #fff0a3 0%, #f5c842 42%, #d39b20 100%)',
  },
  {
    id: 'wasp-ink',
    label: 'Wasp ink',
    value: 'linear-gradient(135deg, #17120a 0%, #2c230e 48%, #f5c842 100%)',
  },
  {
    id: 'purple-sting',
    label: 'Purple sting',
    value: 'linear-gradient(135deg, #211a33 0%, #5f45a8 52%, #f5c842 100%)',
  },
  {
    id: 'teal-complement',
    label: 'Teal complement',
    value: 'linear-gradient(135deg, #103737 0%, #1e806f 52%, #f5c842 100%)',
  },
  { id: 'paper', label: 'Warm paper', value: '#f7f5f0' },
  { id: 'charcoal', label: 'Charcoal', value: '#111111' },
]

const paddingOptions = [32, 48, 64, 80]
const radiusOptions = [0, 12, 24, 36]
const minFrameWidth = 420
const maxFrameWidth = 1280
const defaultFrameWidth = 860
const frameWidthKeyStep = 20
const codeStorageKey = 'wasp-shot:last-code'

const defaultCode = `import { HttpError } from 'wasp/server'

export const createTask = async ({ description }, context) => {
  if (!context.user) {
    throw new HttpError(401)
  }

  return context.entities.Task.create({
    data: {
      description,
      isDone: false,
      user: { connect: { id: context.user.id } },
    },
  })
}`

const lineHighlightEffect = StateEffect.define<Set<number>>()
const highlightedLineDecoration = Decoration.line({ class: 'cm-highlighted-line' })

class SelectedLineMarker extends GutterMarker {
  elementClass = 'cm-selected-line-number'

  eq(other: GutterMarker) {
    return other instanceof SelectedLineMarker
  }
}

const selectedLineMarker = new SelectedLineMarker()

const buildLineDecorations = (state: EditorState, lines: Set<number>) => {
  const builder = new RangeSetBuilder<Decoration>()

  for (const lineNumber of [...lines].sort((a, b) => a - b)) {
    if (lineNumber <= state.doc.lines) {
      const line = state.doc.line(lineNumber)
      builder.add(line.from, line.from, highlightedLineDecoration)
    }
  }

  return builder.finish()
}

const buildLineNumberMarkers = (state: EditorState, lines: Set<number>) => {
  const builder = new RangeSetBuilder<GutterMarker>()

  for (const lineNumber of [...lines].sort((a, b) => a - b)) {
    if (lineNumber <= state.doc.lines) {
      const line = state.doc.line(lineNumber)
      builder.add(line.from, line.from, selectedLineMarker)
    }
  }

  return builder.finish()
}

const highlightedLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(lineHighlightEffect)) {
        return buildLineDecorations(transaction.state, effect.value)
      }
    }

    return transaction.docChanged ? decorations.map(transaction.changes) : decorations
  },
  provide: (field) => EditorView.decorations.from(field),
})

const selectedLineNumberField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(markers, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(lineHighlightEffect)) {
        return buildLineNumberMarkers(transaction.state, effect.value)
      }
    }

    return transaction.docChanged ? markers.map(transaction.changes) : markers
  },
  provide: (field) => lineNumberMarkers.from(field),
})

const waspHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: '#999999', fontStyle: 'italic' },
  { tag: [tags.string, tags.character, tags.heading], color: '#777777' },
  { tag: [tags.punctuation, tags.operator], color: '#555555' },
  {
    tag: [tags.number, tags.bool, tags.variableName, tags.propertyName, tags.constant(tags.name)],
    color: '#333333',
  },
  {
    tag: [tags.keyword, tags.atom, tags.tagName, tags.attributeName],
    color: '#b8941f',
    fontWeight: '700',
  },
  {
    tag: [
      tags.function(tags.variableName),
      tags.className,
      tags.typeName,
      tags.standard(tags.name),
    ],
    color: '#333333',
    fontWeight: '700',
  },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
])

const getLanguageExtension = (language: LanguageValue): Extension => {
  switch (language) {
    case 'css':
      return css()
    case 'html':
      return html()
    case 'javascript':
      return javascript()
    case 'jsx':
      return javascript({ jsx: true })
    case 'json':
      return json()
    case 'markdown':
      return markdown()
    case 'python':
      return python()
    case 'tsx':
      return javascript({ jsx: true, typescript: true })
    case 'typescript':
      return javascript({ typescript: true })
    default:
      return []
  }
}

const getInitialCode = () => {
  try {
    return window.localStorage.getItem(codeStorageKey) ?? defaultCode
  } catch {
    return defaultCode
  }
}

const clampFrameWidth = (width: number) =>
  Math.min(maxFrameWidth, Math.max(minFrameWidth, Math.round(width)))

const buildLineRange = (firstLine: number, lastLine: number) => {
  const selectedLines = new Set<number>()
  const start = Math.min(firstLine, lastLine)
  const end = Math.max(firstLine, lastLine)

  for (let line = start; line <= end; line += 1) {
    selectedLines.add(line)
  }

  return selectedLines
}

const formatHighlightedLines = (lines: Set<number>) => {
  const sortedLines = [...lines].sort((a, b) => a - b)

  if (sortedLines.length === 0) return 'Highlighted lines: none'
  if (sortedLines.length === 1) return `Highlighted line: ${sortedLines[0]}`

  const isContiguous = sortedLines.every(
    (lineNumber, index) => index === 0 || lineNumber === sortedLines[index - 1] + 1,
  )

  if (isContiguous) {
    return `Highlighted lines: ${sortedLines[0]}-${sortedLines[sortedLines.length - 1]} (${sortedLines.length} lines)`
  }

  const previewLines = sortedLines.slice(0, 4).join(', ')
  const overflow = sortedLines.length > 4 ? `, +${sortedLines.length - 4} more` : ''

  return `Highlighted lines: ${previewLines}${overflow} (${sortedLines.length} lines)`
}

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

    if ((v1x * v2x + v1y * v2y) / (l1 * l2) < cornerTurnCosine) {
      corners.add(i)
    }
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

const shouldExportNode = (node: Node) => {
  if (!(node instanceof HTMLElement)) return true

  const className = String(node.className)
  return !['cm-cursorLayer', 'cm-selectionLayer', 'cm-tooltip', 'cm-announced', 'width-handle'].some(
    (hiddenClass) => className.includes(hiddenClass),
  )
}

export function App() {
  const editorHostRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<EditorView | null>(null)
  const shotRef = useRef<HTMLDivElement>(null)
  const codeRef = useRef('')
  const highlightedLinesRef = useRef(new Set<number>())
  const lineSelectionAnchorRef = useRef<number | null>(null)
  const lineDragAnchorRef = useRef<number | null>(null)
  const lineDragBaseRef = useRef<Set<number> | null>(null)
  const lineDragModeRef = useRef<LineDragMode>('add')
  const isDraggingLineRef = useRef(false)
  const [code, setCode] = useState(getInitialCode)
  const [languageId, setLanguageId] = useState('typescript')
  const [backgroundId, setBackgroundId] = useState('yellow')
  const [padding, setPadding] = useState(48)
  const [radius, setRadius] = useState(12)
  const [frameWidth, setFrameWidth] = useState(defaultFrameWidth)
  const widthDragRef = useRef<{ startX: number; startWidth: number; scale: number } | null>(null)
  const [showChrome, setShowChrome] = useState(true)
  const [highlightedLines, setHighlightedLines] = useState<Set<number>>(() => new Set())
  const [exportAction, setExportAction] = useState<ExportAction>(null)
  const [message, setMessage] = useState('')
  const [isPenActive, setIsPenActive] = useState(false)
  const [penStrokes, setPenStrokes] = useState<number[][][]>([])
  const activePenPointsRef = useRef<number[][] | null>(null)
  const [, setPenTick] = useState(0)
  const previewViewportRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(1)

  const selectedLanguage =
    languageOptions.find((option) => option.id === languageId) ?? languageOptions[0]
  const selectedBackground =
    backgroundOptions.find((option) => option.id === backgroundId) ?? backgroundOptions[0]
  const selectedLineCount = highlightedLines.size
  const highlightedLineStatus = formatHighlightedLines(highlightedLines)
  const isCopying = exportAction === 'copy'
  const isDownloading = exportAction === 'download'
  const isExporting = exportAction !== null

  codeRef.current = code
  highlightedLinesRef.current = highlightedLines

  useEffect(() => {
    try {
      window.localStorage.setItem(codeStorageKey, code)
    } catch {
      return
    }
  }, [code])

  useEffect(() => {
    const editorView = editorViewRef.current

    if (editorView) {
      editorView.dispatch({ effects: lineHighlightEffect.of(highlightedLines) })
    }
  }, [highlightedLines])

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

  useEffect(() => {
    if (!editorHostRef.current) return

    const applyLineRange = (
      firstLine: number,
      lastLine: number,
      mode: LineDragMode,
      baseLines: Set<number>,
    ) => {
      const lineRange = buildLineRange(firstLine, lastLine)

      setHighlightedLines(() => {
        const nextLines = new Set(baseLines)

        for (const lineNumber of lineRange) {
          if (mode === 'add') {
            nextLines.add(lineNumber)
          } else {
            nextLines.delete(lineNumber)
          }
        }

        return nextLines
      })
    }

    const editorView = new EditorView({
      parent: editorHostRef.current,
      state: EditorState.create({
        doc: codeRef.current,
        extensions: [
          minimalSetup,
          getLanguageExtension(selectedLanguage.lang),
          syntaxHighlighting(waspHighlightStyle),
          EditorState.tabSize.of(2),
          EditorView.lineWrapping,
          placeholder('Paste or type your code...'),
          EditorView.contentAttributes.of({
            'aria-label': 'Code editor',
            'aria-describedby': 'editor-help highlight-status',
          }),
          keymap.of([indentWithTab]),
          lineNumbers({
            domEventHandlers: {
              mousedown: (view, line, event) => {
                const mouseEvent = event as MouseEvent
                const lineNumber = view.state.doc.lineAt(line.from).number

                mouseEvent.preventDefault()
                const baseLines = new Set(highlightedLinesRef.current)
                const anchorLine = mouseEvent.shiftKey
                  ? (lineSelectionAnchorRef.current ?? lineNumber)
                  : lineNumber

                lineSelectionAnchorRef.current = lineNumber
                lineDragAnchorRef.current = anchorLine
                lineDragBaseRef.current = baseLines
                lineDragModeRef.current =
                  !mouseEvent.shiftKey && highlightedLinesRef.current.has(lineNumber)
                    ? 'remove'
                    : 'add'
                isDraggingLineRef.current = true
                applyLineRange(anchorLine, lineNumber, lineDragModeRef.current, baseLines)

                window.addEventListener(
                  'mouseup',
                  () => {
                    isDraggingLineRef.current = false
                    lineDragAnchorRef.current = null
                    lineDragBaseRef.current = null
                  },
                  { once: true },
                )

                return true
              },
              mousemove: (view, line, event) => {
                if (
                  !isDraggingLineRef.current ||
                  lineDragAnchorRef.current == null ||
                  lineDragBaseRef.current == null
                ) {
                  return false
                }

                const mouseEvent = event as MouseEvent
                const lineNumber = view.state.doc.lineAt(line.from).number

                mouseEvent.preventDefault()
                applyLineRange(
                  lineDragAnchorRef.current,
                  lineNumber,
                  lineDragModeRef.current,
                  lineDragBaseRef.current,
                )
                return true
              },
            },
          }),
          highlightedLineField,
          selectedLineNumberField,
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return

            const nextCode = update.state.doc.toString()
            codeRef.current = nextCode
            setCode(nextCode)
            setHighlightedLines((previousLines) => {
              const visibleLines = new Set(
                [...previousLines].filter((lineNumber) => lineNumber <= update.state.doc.lines),
              )

              return visibleLines.size === previousLines.size ? previousLines : visibleLines
            })
          }),
        ],
      }),
    })

    editorViewRef.current = editorView
    editorView.dispatch({ effects: lineHighlightEffect.of(highlightedLinesRef.current) })

    return () => {
      editorView.destroy()
      if (editorViewRef.current === editorView) {
        editorViewRef.current = null
      }
    }
  }, [selectedLanguage.lang])

  const highlightCurrentLine = () => {
    const editorView = editorViewRef.current

    if (!editorView) return

    const lineNumber = editorView.state.doc.lineAt(editorView.state.selection.main.head).number

    lineSelectionAnchorRef.current = lineNumber
    setHighlightedLines((previousLines) => {
      if (previousLines.has(lineNumber)) return previousLines

      const nextLines = new Set(previousLines)
      nextLines.add(lineNumber)
      return nextLines
    })
    editorView.focus()
  }

  const clearHighlights = () => {
    setHighlightedLines(new Set())
  }

  const getPenPoint = (event: PointerEvent) => {
    const bounds = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
    return [
      (event.clientX - bounds.left) / previewScale,
      (event.clientY - bounds.top) / previewScale,
      event.pressure,
    ]
  }

  const startPenStroke = (event: PointerEvent) => {
    event.preventDefault()
    ;(event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId)
    activePenPointsRef.current = [getPenPoint(event)]
    setPenTick((tick) => tick + 1)
  }

  const extendPenStroke = (event: PointerEvent) => {
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

  const undoPenStroke = () => {
    setPenStrokes((previousStrokes) => previousStrokes.slice(0, -1))
  }

  const clearPenStrokes = () => {
    setPenStrokes([])
  }

  const startWidthDrag = (event: PointerEvent) => {
    event.preventDefault()
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    widthDragRef.current = { startX: event.clientX, startWidth: frameWidth, scale: previewScale }
  }

  const moveWidthDrag = (event: PointerEvent) => {
    const drag = widthDragRef.current

    if (!drag) return

    // The frame stays centered, so the edge moves half as fast as the width grows.
    const widthDelta = ((event.clientX - drag.startX) * 2) / drag.scale
    setFrameWidth(clampFrameWidth(drag.startWidth + widthDelta))
  }

  const endWidthDrag = () => {
    widthDragRef.current = null
  }

  const nudgeFrameWidth = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

    event.preventDefault()
    const step = event.key === 'ArrowRight' ? frameWidthKeyStep : -frameWidthKeyStep
    setFrameWidth((previousWidth) => clampFrameWidth(previousWidth + step))
  }

  const renderPngBlob = () => {
    const frame = shotRef.current

    if (!frame) return null

    return domToBlob(frame, {
      backgroundColor: null,
      scale: 2,
      width: frame.offsetWidth,
      height: frame.offsetHeight,
      filter: shouldExportNode,
    })
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
    <main class="app-shell">
      <h1 class="sr-only">Wasp code screenshot tool</h1>
      <section class="workspace" aria-label="Editable screenshot">
        <div class="preview-viewport" ref={previewViewportRef}>
          <div class="preview-stage">
            <div class="stage-cluster">
              <div class="shot-toolbar">
                <div class="toolbar-group">
                  <button
                    class="pen-button pen-button-primary"
                    type="button"
                    onClick={copyPng}
                    disabled={isExporting}
                  >
                    {isCopying ? 'Copying...' : 'Copy PNG'}
                  </button>
                  <button
                    class="pen-button"
                    type="button"
                    onClick={downloadPng}
                    disabled={isExporting}
                  >
                    {isDownloading ? 'Downloading...' : 'Download PNG'}
                  </button>
                  <span id="export-status" class="toolbar-status" role="status" aria-live="polite">
                    {message}
                  </span>
                </div>
                <div class="toolbar-group">
                  {penStrokes.length > 0 && (
                    <>
                      <button class="pen-button" type="button" onClick={undoPenStroke}>
                        <svg class="pen-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M9 14 4 9l5-5" />
                          <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
                        </svg>
                        Undo
                      </button>
                      <button class="pen-button" type="button" onClick={clearPenStrokes}>
                        <svg class="pen-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                        Clear
                      </button>
                    </>
                  )}
                  <button
                    class={isPenActive ? 'pen-button pen-button-active' : 'pen-button'}
                    type="button"
                    aria-pressed={isPenActive}
                    onClick={() => setIsPenActive((active) => !active)}
                  >
                    <svg class="pen-icon" viewBox="0 0 24 24" aria-hidden="true">
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
                  class="shot-frame"
                  style={{
                    background: selectedBackground.value,
                    padding: `${padding}px`,
                    width: `${frameWidth}px`,
                    '--shot-padding': `${padding}px`,
                  }}
                >
                  <div class="code-window" style={{ borderRadius: `${radius}px` }}>
                    {showChrome && (
                      <div class="window-bar">
                        <div class="window-dots" aria-hidden="true">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                        <span>{selectedLanguage.label}</span>
                      </div>
                    )}
                    <div class="code-body">
                      <div ref={editorHostRef} class="code-editor-host" />
                    </div>
                  </div>
                  <div
                    class="width-handle"
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
                    onDblClick={() => setFrameWidth(defaultFrameWidth)}
                    onKeyDown={nudgeFrameWidth}
                  />
                  {(isPenActive || penStrokes.length > 0) && (
                    <svg
                      class={isPenActive ? 'draw-layer draw-layer-active' : 'draw-layer'}
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

              <p id="editor-help" class="editor-help">
                Edit or paste code. Click line numbers to highlight. Shift-click or drag for ranges.
                Toggle Draw to sketch on top.
              </p>
            </div>
          </div>
        </div>

        <div class="control-panel" aria-label="Screenshot controls">
          <div class="control-groups">
            <details class="control-group" open>
              <summary class="control-summary">
                <span class="control-title">Look</span>
              </summary>
              <div class="control-content look-content">
                <label class="toolbar-field" htmlFor="syntax">
                  <span>Syntax</span>
                  <select
                    id="syntax"
                    name="syntax"
                    value={languageId}
                    onInput={(event) =>
                      setLanguageId((event.currentTarget as HTMLSelectElement).value)
                    }
                  >
                    {languageOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label class="toolbar-field" htmlFor="background">
                  <span>Background</span>
                  <select
                    id="background"
                    name="background"
                    value={backgroundId}
                    onInput={(event) =>
                      setBackgroundId((event.currentTarget as HTMLSelectElement).value)
                    }
                  >
                    {backgroundOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label class="toolbar-field compact-field" htmlFor="background-padding">
                  <span>Padding</span>
                  <select
                    id="background-padding"
                    name="background-padding"
                    value={String(padding)}
                    onInput={(event) =>
                      setPadding(Number((event.currentTarget as HTMLSelectElement).value))
                    }
                  >
                    {paddingOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}px
                      </option>
                    ))}
                  </select>
                </label>

                <label class="toolbar-field compact-field" htmlFor="corner-radius">
                  <span>Corner radius</span>
                  <select
                    id="corner-radius"
                    name="corner-radius"
                    value={String(radius)}
                    onInput={(event) =>
                      setRadius(Number((event.currentTarget as HTMLSelectElement).value))
                    }
                  >
                    {radiusOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}px
                      </option>
                    ))}
                  </select>
                </label>

                <label class="toolbar-toggle" htmlFor="show-window-bar">
                  <input
                    id="show-window-bar"
                    name="show-window-bar"
                    type="checkbox"
                    checked={showChrome}
                    onInput={(event) =>
                      setShowChrome((event.currentTarget as HTMLInputElement).checked)
                    }
                  />
                  <span>Show window bar</span>
                </label>
              </div>
            </details>

            <details class="control-group">
              <summary class="control-summary">
                <span class="control-title">Highlights</span>
                <span id="highlight-status" class="highlight-status" aria-live="polite">
                  {highlightedLineStatus}
                </span>
              </summary>
              <div class="control-content">
                <button class="secondary-button" type="button" onClick={highlightCurrentLine}>
                  Highlight current line
                </button>
                <button
                  class="secondary-button"
                  type="button"
                  onClick={clearHighlights}
                  disabled={selectedLineCount === 0}
                >
                  Clear highlights
                </button>
              </div>
            </details>
          </div>
        </div>
      </section>
    </main>
  )
}
