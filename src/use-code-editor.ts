import { useCallback, useEffect, useRef, useState, type RefCallback } from 'react'
import { indentWithTab } from '@codemirror/commands'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { php } from '@codemirror/lang-php'
import { python } from '@codemirror/lang-python'
import {
  Compartment,
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
import { minimalSetup } from 'codemirror'

type HighlightLanguage =
  | 'css'
  | 'html'
  | 'javascript'
  | 'json'
  | 'jsx'
  | 'markdown'
  | 'php'
  | 'python'
  | 'tsx'
  | 'typescript'

type LanguageValue = HighlightLanguage | 'text'

export type LanguageOption = {
  id: string
  label: string
  lang: LanguageValue
}

type LineDragMode = 'add' | 'remove'

type UseCodeEditorOptions = {
  languageId: string
  ambientEditorExtension: Extension
  ariaDescribedBy: string
  initialCode?: string
  persistCode?: boolean
}

const languageOptions: readonly LanguageOption[] = [
  { id: 'typescript', label: 'TypeScript', lang: 'typescript' },
  { id: 'tsx', label: 'TSX', lang: 'tsx' },
  { id: 'javascript', label: 'JavaScript', lang: 'javascript' },
  { id: 'jsx', label: 'JSX', lang: 'jsx' },
  { id: 'json', label: 'JSON', lang: 'json' },
  { id: 'css', label: 'CSS', lang: 'css' },
  { id: 'html', label: 'HTML', lang: 'html' },
  { id: 'php', label: 'PHP', lang: 'php' },
  { id: 'python', label: 'Python', lang: 'python' },
  { id: 'markdown', label: 'Markdown', lang: 'markdown' },
  { id: 'text', label: 'Plain text', lang: 'text' },
]

const codeStorageKey = 'wasp-shot:last-code'
const highlightedLinesStorageKey = 'codeshot.highlighted-lines'

const readPersistedHighlightedLines = () => {
  try {
    const value = globalThis.localStorage?.getItem(highlightedLinesStorageKey)
    if (!value) return new Set<number>()
    const lines = JSON.parse(value)
    return new Set(
      Array.isArray(lines)
        ? lines.filter((line): line is number => Number.isInteger(line) && line > 0)
        : [],
    )
  } catch {
    return new Set<number>()
  }
}

export const defaultCode = `import { HttpError } from 'wasp/server'

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
    case 'php':
      return php()
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

const readHighlightedLines = (state: EditorState) => {
  const lines = new Set<number>()

  for (let cursor = state.field(highlightedLineField).iter(); cursor.value; cursor.next()) {
    lines.add(state.doc.lineAt(cursor.from).number)
  }

  return lines
}

const haveSameLines = (first: Set<number>, second: Set<number>) =>
  first.size === second.size && [...first].every((line) => second.has(line))

export function useCodeEditor({
  languageId,
  ambientEditorExtension,
  ariaDescribedBy,
  initialCode = defaultCode,
  persistCode = true,
}: UseCodeEditorOptions) {
  const [highlightedLines, setHighlightedLines] = useState<Set<number>>(
    () => persistCode ? readPersistedHighlightedLines() : new Set(),
  )
  const editorViewRef = useRef<EditorView | null>(null)
  const editorHostElementRef = useRef<HTMLDivElement | null>(null)
  const languageCompartmentRef = useRef(new Compartment())
  const ambientCompartmentRef = useRef(new Compartment())
  const highlightedLinesRef = useRef(new Set(highlightedLines))
  const lineSelectionAnchorRef = useRef<number | null>(null)
  const lineDragAnchorRef = useRef<number | null>(null)
  const lineDragBaseRef = useRef<Set<number> | null>(null)
  const lineDragModeRef = useRef<LineDragMode>('add')
  const isDraggingLineRef = useRef(false)
  const [editorHostElement, setEditorHostElement] = useState<HTMLDivElement | null>(null)
  const [code, setCode] = useState(initialCode)
  const [isEditorReady, setIsEditorReady] = useState(false)

  const selectedLanguage =
    languageOptions.find((option) => option.id === languageId) ?? languageOptions[0]

  const editorHostRef: RefCallback<HTMLDivElement> = useCallback((host) => {
    editorHostElementRef.current = host
    if (!editorViewRef.current) setEditorHostElement(host)
    if (!host) return

    const editorView = editorViewRef.current

    if (editorView && editorView.dom.parentElement !== host) {
      editorView.setRoot(host.getRootNode() as Document | ShadowRoot)
      host.append(editorView.dom)
      editorView.requestMeasure()
    }
  }, [])

  useEffect(() => {
    if (!editorHostElement) return

    let restoredCode = initialCode
    let restoredHighlightedLines = new Set(highlightedLinesRef.current)

    if (persistCode) {
      try {
        const persistedCode = window.localStorage.getItem(codeStorageKey)
        if (persistedCode === null) {
          window.localStorage.setItem(codeStorageKey, initialCode)
        } else {
          restoredCode = persistedCode
        }
      } catch {
        // Storage can be unavailable while the editor remains fully usable.
      }
    }

    setCode(restoredCode)
    const restoredLineCount = restoredCode.split('\n').length
    restoredHighlightedLines = new Set(
      [...restoredHighlightedLines].filter((line) => line <= restoredLineCount),
    )
    highlightedLinesRef.current = restoredHighlightedLines
    setHighlightedLines(restoredHighlightedLines)

    const applyLineRange = (
      firstLine: number,
      lastLine: number,
      mode: LineDragMode,
      baseLines: Set<number>,
    ) => {
      const lineRange = buildLineRange(firstLine, lastLine)
      const nextLines = new Set(baseLines)

      for (const lineNumber of lineRange) {
        if (mode === 'add') {
          nextLines.add(lineNumber)
        } else {
          nextLines.delete(lineNumber)
        }
      }

      highlightedLinesRef.current = nextLines
      setHighlightedLines(nextLines)
    }

    function finishLineDrag() {
      isDraggingLineRef.current = false
      lineDragAnchorRef.current = null
      lineDragBaseRef.current = null
    }

    const editorView = new EditorView({
      parent: editorHostElement,
      root: editorHostElement.ownerDocument,
      state: EditorState.create({
        doc: restoredCode,
        extensions: [
          minimalSetup,
          languageCompartmentRef.current.of(getLanguageExtension(selectedLanguage.lang)),
          ambientCompartmentRef.current.of(ambientEditorExtension),
          EditorState.tabSize.of(2),
          EditorView.lineWrapping,
          placeholder('Paste or type your code...'),
          EditorView.contentAttributes.of({
            'aria-label': 'Code editor',
            'aria-describedby': ariaDescribedBy,
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

                window.removeEventListener('mouseup', finishLineDrag)
                window.addEventListener('mouseup', finishLineDrag, { once: true })
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
            setCode(nextCode)

            if (persistCode) {
              try {
                window.localStorage.setItem(codeStorageKey, nextCode)
              } catch {
                // Editing must not depend on storage availability.
              }
            }

            const nextLines = readHighlightedLines(update.state)
            highlightedLinesRef.current = nextLines
            setHighlightedLines((previousLines) =>
              haveSameLines(previousLines, nextLines) ? previousLines : nextLines,
            )

            if (lineSelectionAnchorRef.current !== null) {
              lineSelectionAnchorRef.current = Math.min(
                lineSelectionAnchorRef.current,
                update.state.doc.lines,
              )
            }
            finishLineDrag()
          }),
        ],
      }),
    })

    editorViewRef.current = editorView
    editorView.dispatch({ effects: lineHighlightEffect.of(highlightedLinesRef.current) })
    setIsEditorReady(true)

    return () => {
      window.removeEventListener('mouseup', finishLineDrag)
      finishLineDrag()
      editorView.destroy()
      if (editorViewRef.current === editorView) editorViewRef.current = null
      setIsEditorReady(false)
    }
  }, [editorHostElement, initialCode, persistCode])

  useEffect(() => {
    const editorView = editorViewRef.current
    if (!editorView) return

    editorView.dispatch({
      effects: languageCompartmentRef.current.reconfigure(
        getLanguageExtension(selectedLanguage.lang),
      ),
    })
  }, [selectedLanguage.lang])

  useEffect(() => {
    const editorView = editorViewRef.current
    if (!editorView) return

    editorView.dispatch({
      effects: ambientCompartmentRef.current.reconfigure(ambientEditorExtension),
    })
  }, [ambientEditorExtension])

  useEffect(() => {
    const editorView = editorViewRef.current
    if (editorView) {
      editorView.dispatch({ effects: lineHighlightEffect.of(highlightedLines) })
    }
    if (persistCode) {
      try {
        window.localStorage.setItem(highlightedLinesStorageKey, JSON.stringify([...highlightedLines]))
      } catch {
        // Highlighting does not depend on local persistence.
      }
    }
  }, [highlightedLines, persistCode])

  const highlightCurrentLine = () => {
    const editorView = editorViewRef.current
    if (!editorView) return

    const lineNumber = editorView.state.doc.lineAt(editorView.state.selection.main.head).number
    lineSelectionAnchorRef.current = lineNumber

    if (!highlightedLinesRef.current.has(lineNumber)) {
      const nextLines = new Set(highlightedLinesRef.current)
      nextLines.add(lineNumber)
      highlightedLinesRef.current = nextLines
      setHighlightedLines(nextLines)
    }

    editorView.focus()
  }

  const clearHighlights = () => {
    const nextLines = new Set<number>()
    highlightedLinesRef.current = nextLines
    lineSelectionAnchorRef.current = null
    setHighlightedLines(nextLines)
  }

  return {
    languageOptions,
    selectedLanguage,
    code,
    editorHostRef,
    isEditorReady,
    highlightedLineCount: highlightedLines.size,
    highlightedLineStatus: formatHighlightedLines(highlightedLines),
    highlightCurrentLine,
    clearHighlights,
  }
}
