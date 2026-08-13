import { useEffect, useId, useMemo, useState } from 'react'
import { ambientDefinitions, getAmbientKey, resolveAmbientVariables } from '../ambient/rendering/ambient-themes'
import { loadAmbientDefinition } from '../ambient/rendering/ambient-registry'
import type { AmbientDefinition, ScreenshotContent } from '../ambient/rendering/ambient-themes'
import type { ScreenshotRenderRequest } from './render-contract'
import { ScreenshotFrame } from './screenshot-frame'
import { useCodeEditor } from './use-code-editor'
import './render-screenshot-page.css'

const resolveAmbient = (request: ScreenshotRenderRequest): AmbientDefinition | null => {
  if (request.theme.kind === 'built-in') {
    return ambientDefinitions.find(
      (ambient) => ambient.id === request.theme.id && ambient.version === request.theme.version,
    ) ?? null
  }

  return loadAmbientDefinition({
    id: request.theme.id,
    version: request.theme.version,
    document: request.theme.document,
  }, 'shared').definition
}

export function RenderScreenshotPage() {
  const [request, setRequest] = useState<ScreenshotRenderRequest | null | undefined>(undefined)

  useEffect(() => {
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex, nofollow')
    setRequest(window.__CODESHOT_RENDER_REQUEST__ ?? null)
  }, [])

  if (request === undefined) {
    return <main className="screenshot-render-page" data-screenshot-state="loading" />
  }
  if (!request) return <main className="screenshot-render-page" data-screenshot-state="error" />
  return <RenderScreenshotCanvas request={request} />
}

function RenderScreenshotCanvas({ request }: { request: ScreenshotRenderRequest }) {
  const helpId = `${useId()}-render-editor-help`
  const ambient = useMemo(() => resolveAmbient(request), [request])
  const editor = useCodeEditor({
    languageId: request.language,
    ambientEditorExtension: ambient?.editorExtension ?? [],
    ariaDescribedBy: helpId,
    initialCode: request.code,
    initialHighlightedLines: request.highlightedLines,
    persistCode: false,
  })

  if (!ambient) return <main className="screenshot-render-page" data-screenshot-state="error" />

  const content: ScreenshotContent = {
    title: request.title,
    fileType: {
      id: editor.selectedLanguage.id,
      label: editor.selectedLanguage.label,
      syntax: editor.selectedLanguage.lang,
    },
    lineCount: editor.code.split('\n').length,
  }
  const customizationState = { [getAmbientKey(ambient)]: request.customizations }

  return (
    <main
      className="screenshot-render-page"
      data-screenshot-state={editor.isEditorReady ? 'ready' : 'rendering'}
    >
      <ScreenshotFrame
        ambient={ambient}
        ambientVariables={resolveAmbientVariables(ambient, customizationState)}
        content={content}
        editorHostRef={editor.editorHostRef}
        isEditorReady={editor.isEditorReady}
        isExporting
        width={request.width}
      />
      <span id={helpId} hidden>Code screenshot</span>
    </main>
  )
}
