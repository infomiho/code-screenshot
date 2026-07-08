import { useEffect, useRef, useState } from 'preact/hooks'
import { domToPng } from 'modern-screenshot'
import { createBundledHighlighter, createSingletonShorthands } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { waspShikiTheme } from './waspShikiTheme'

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

const createHighlighter = createBundledHighlighter({
  langs: {
    bash: () => import('@shikijs/langs/bash'),
    css: () => import('@shikijs/langs/css'),
    html: () => import('@shikijs/langs/html'),
    javascript: () => import('@shikijs/langs/javascript'),
    json: () => import('@shikijs/langs/json'),
    jsx: () => import('@shikijs/langs/jsx'),
    markdown: () => import('@shikijs/langs/markdown'),
    python: () => import('@shikijs/langs/python'),
    tsx: () => import('@shikijs/langs/tsx'),
    typescript: () => import('@shikijs/langs/typescript'),
  },
  themes: {},
  engine: createJavaScriptRegexEngine,
})

const { codeToHtml } = createSingletonShorthands(createHighlighter)

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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

const insertAtSelection = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  insertion: string,
) =>
  value.slice(0, selectionStart) + insertion + value.slice(selectionEnd)

const getInitialCode = () => {
  try {
    return window.localStorage.getItem(codeStorageKey) ?? defaultCode
  } catch {
    return defaultCode
  }
}

export function App() {
  const shotRef = useRef<HTMLDivElement>(null)
  const [code, setCode] = useState(getInitialCode)
  const [languageId, setLanguageId] = useState('typescript')
  const [backgroundId, setBackgroundId] = useState('yellow')
  const [padding, setPadding] = useState(48)
  const [radius, setRadius] = useState(12)
  const [showChrome, setShowChrome] = useState(true)
  const [highlightedCode, setHighlightedCode] = useState('')
  const [isHighlighting, setIsHighlighting] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [message, setMessage] = useState('')

  const selectedLanguage =
    languageOptions.find((option) => option.id === languageId) ?? languageOptions[0]
  const selectedBackground =
    backgroundOptions.find((option) => option.id === backgroundId) ?? backgroundOptions[0]
  const lineCount = code.length === 0 ? 0 : code.split('\n').length

  useEffect(() => {
    try {
      window.localStorage.setItem(codeStorageKey, code)
    } catch {
      return
    }
  }, [code])

  useEffect(() => {
    let isCurrent = true
    setIsHighlighting(true)

    codeToHtml(code || ' ', {
      lang: selectedLanguage.lang,
      theme: waspShikiTheme,
    })
      .then((html) => {
        if (isCurrent) {
          setHighlightedCode(html)
          setMessage('')
        }
      })
      .catch(() => {
        if (isCurrent) {
          setHighlightedCode(`<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`)
          setMessage('Highlighting failed. Showing escaped plain text.')
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsHighlighting(false)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [code, selectedLanguage.lang])

  const exportPng = async () => {
    if (!shotRef.current) return

    setIsExporting(true)
    setMessage('')

    try {
      const dataUrl = await domToPng(shotRef.current, {
        backgroundColor: null,
        scale: 2,
        filter: (node) =>
          !(node instanceof HTMLElement && node.dataset.exportHidden === 'true'),
      })
      const link = document.createElement('a')
      link.download = 'wasp-code-screenshot.png'
      link.href = dataUrl
      link.click()
      setMessage('PNG exported.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Export failed.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <main class="app-shell">
      <header class="toolbar" aria-label="Wasp Shot controls">
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
            <span>Chrome</span>
          </label>

          <button class="export-button" type="button" onClick={exportPng} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export PNG'}
          </button>
        </div>
      </header>

      <section class="workspace" aria-label="Editable screenshot">
        <section class="panel screenshot-panel">
          <div class="pane-header">
            <span>{isHighlighting ? 'Highlighting...' : selectedLanguage.label}</span>
            <span>{lineCount} lines</span>
          </div>

          <div class="preview-viewport">
            <div class="preview-stage">
              <div
                ref={shotRef}
                class="shot-frame"
                style={{
                  background: selectedBackground.value,
                  padding: `${padding}px`,
                  borderRadius: `${radius}px`,
                }}
              >
                <div class="code-window">
                  {showChrome && (
                    <div class="window-bar">
                      <div class="window-dots" aria-hidden="true">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <span>{selectedLanguage.label}</span>
                      <strong>wasp</strong>
                    </div>
                  )}
                  <div class="code-body">
                    <div class="editable-code-layer">
                      <div
                        class="highlight-layer"
                        aria-hidden="true"
                        dangerouslySetInnerHTML={{ __html: highlightedCode }}
                      />
                      <textarea
                        class="screenshot-editor"
                        aria-label="Code"
                        data-export-hidden="true"
                        spellcheck={false}
                        wrap="off"
                        value={code}
                        onInput={(event) =>
                          setCode((event.currentTarget as HTMLTextAreaElement).value)
                        }
                        onKeyDown={(event) => {
                          if (event.key !== 'Tab') return

                          event.preventDefault()
                          const textarea = event.currentTarget as HTMLTextAreaElement
                          const nextCode = insertAtSelection(
                            code,
                            textarea.selectionStart,
                            textarea.selectionEnd,
                            '  ',
                          )
                          const nextCursor = textarea.selectionStart + 2
                          setCode(nextCode)
                          requestAnimationFrame(() => {
                            textarea.selectionStart = nextCursor
                            textarea.selectionEnd = nextCursor
                          })
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="status-bar">
            <span>Click the code frame and type.</span>
            {message && <span>{message}</span>}
          </div>
        </section>
      </section>
    </main>
  )
}
