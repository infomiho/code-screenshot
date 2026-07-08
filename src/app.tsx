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
  type DecorationSet,
} from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { tags } from '@lezer/highlight'
import { domToBlob } from 'modern-screenshot'

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
  { id: 'paper', label: 'Warm paper', value: '#f7f5f0' },
  { id: 'purple', label: 'Deep purple', value: '#292435' },
  { id: 'charcoal', label: 'Charcoal', value: '#111111' },
]

const paddingOptions = [32, 48, 64, 80]
const radiusOptions = [0, 12, 24, 36]
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
    tag: [tags.function(tags.variableName), tags.className, tags.typeName, tags.standard(tags.name)],
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

const buildLineRange = (firstLine: number, lastLine: number) => {
  const selectedLines = new Set<number>()
  const start = Math.min(firstLine, lastLine)
  const end = Math.max(firstLine, lastLine)

  for (let line = start; line <= end; line += 1) {
    selectedLines.add(line)
  }

  return selectedLines
}

const downloadBlob = (blob: Blob) => {
  const link = document.createElement('a')
  const url = window.URL.createObjectURL(blob)

  link.download = 'wasp-code-screenshot.png'
  link.href = url
  link.click()
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0)
}

const shouldExportNode = (node: Node) => {
  if (!(node instanceof HTMLElement)) return true

  const className = String(node.className)
  return ![
    'cm-cursorLayer',
    'cm-selectionLayer',
    'cm-tooltip',
    'cm-announced',
  ].some((hiddenClass) => className.includes(hiddenClass))
}

export function App() {
  const editorHostRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<EditorView | null>(null)
  const shotRef = useRef<HTMLDivElement>(null)
  const codeRef = useRef('')
  const highlightedLinesRef = useRef(new Set<number>())
  const lineSelectionAnchorRef = useRef<number | null>(null)
  const lineDragAnchorRef = useRef<number | null>(null)
  const isDraggingLineRef = useRef(false)
  const [code, setCode] = useState(getInitialCode)
  const [languageId, setLanguageId] = useState('typescript')
  const [backgroundId, setBackgroundId] = useState('yellow')
  const [padding, setPadding] = useState(48)
  const [radius, setRadius] = useState(12)
  const [showChrome, setShowChrome] = useState(true)
  const [highlightedLines, setHighlightedLines] = useState<Set<number>>(() => new Set())
  const [isExporting, setIsExporting] = useState(false)
  const [message, setMessage] = useState('')

  const selectedLanguage =
    languageOptions.find((option) => option.id === languageId) ?? languageOptions[0]
  const selectedBackground =
    backgroundOptions.find((option) => option.id === backgroundId) ?? backgroundOptions[0]
  const selectedLineCount = highlightedLines.size

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
    if (!editorHostRef.current) return

    const selectLineRange = (firstLine: number, lastLine: number) => {
      setHighlightedLines(buildLineRange(firstLine, lastLine))
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
          keymap.of([indentWithTab]),
          lineNumbers({
            domEventHandlers: {
              mousedown: (view, line, event) => {
                const mouseEvent = event as MouseEvent
                const lineNumber = view.state.doc.lineAt(line.from).number

                mouseEvent.preventDefault()
                lineSelectionAnchorRef.current = mouseEvent.shiftKey
                  ? lineSelectionAnchorRef.current ?? lineNumber
                  : lineNumber
                lineDragAnchorRef.current = lineSelectionAnchorRef.current
                isDraggingLineRef.current = true
                selectLineRange(lineDragAnchorRef.current, lineNumber)

                window.addEventListener(
                  'mouseup',
                  () => {
                    isDraggingLineRef.current = false
                    lineDragAnchorRef.current = null
                  },
                  { once: true },
                )

                return true
              },
              mousemove: (view, line, event) => {
                if (!isDraggingLineRef.current || lineDragAnchorRef.current == null) {
                  return false
                }

                const mouseEvent = event as MouseEvent
                const lineNumber = view.state.doc.lineAt(line.from).number

                mouseEvent.preventDefault()
                selectLineRange(lineDragAnchorRef.current, lineNumber)
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

  const renderPngBlob = () => {
    if (!shotRef.current) return null

    return domToBlob(shotRef.current, {
      backgroundColor: null,
      scale: 2,
      filter: shouldExportNode,
    })
  }

  const copyPng = async () => {
    setIsExporting(true)
    setMessage('')

    try {
      const blob = await renderPngBlob()
      if (!blob) return

      if (!navigator.clipboard || !window.ClipboardItem) {
        setMessage('Clipboard unavailable. Use Download PNG.')
        return
      }

      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type || 'image/png']: blob }),
      ])
      setMessage('Copied PNG.')
    } catch {
      setMessage('Copy failed. Use Download PNG.')
    } finally {
      setIsExporting(false)
    }
  }

  const downloadPng = async () => {
    setIsExporting(true)
    setMessage('')

    try {
      const blob = await renderPngBlob()
      if (!blob) return

      downloadBlob(blob)
      setMessage('Downloaded PNG.')
    } catch {
      setMessage('Download failed.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <main class="app-shell">
      <section class="workspace" aria-label="Editable screenshot">
        <div class="preview-viewport">
          <div class="preview-stage">
            <div
              ref={shotRef}
              class="shot-frame"
              style={{
                background: selectedBackground.value,
                padding: `${padding}px`,
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
            </div>

            <div class="toolbar" aria-label="Screenshot controls">
              <div class="toolbar-controls">
                <label class="toolbar-field">
                  <span>Language</span>
                  <select
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

                <label class="toolbar-field">
                  <span>Background</span>
                  <select
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

                <label class="toolbar-field compact-field">
                  <span>Padding</span>
                  <select
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

                <label class="toolbar-field compact-field">
                  <span>Radius</span>
                  <select
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

                <label class="toolbar-toggle">
                  <input
                    type="checkbox"
                    checked={showChrome}
                    onInput={(event) =>
                      setShowChrome((event.currentTarget as HTMLInputElement).checked)
                    }
                  />
                  <span>Window bar</span>
                </label>

                {selectedLineCount > 0 && (
                  <button
                    class="secondary-button"
                    type="button"
                    onClick={() => setHighlightedLines(new Set())}
                  >
                    Clear {selectedLineCount} {selectedLineCount === 1 ? 'line' : 'lines'}
                  </button>
                )}

                {message && <span class="toolbar-status">{message}</span>}

                <button
                  class="secondary-button"
                  type="button"
                  onClick={downloadPng}
                  disabled={isExporting}
                >
                  Download PNG
                </button>

                <button
                  class="export-button"
                  type="button"
                  onClick={copyPng}
                  disabled={isExporting}
                >
                  {isExporting ? 'Working...' : 'Copy PNG'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
