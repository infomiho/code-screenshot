import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { AmbientIdentity } from '../ambient-identity'
import {
  resolveAmbientVariables,
  type AmbientDefinition,
  type ScreenshotContent,
} from '../ambient-themes'
import { DeclarativeAmbient } from '../declarative-ambient'
import { EditorSkeleton } from '../editor-skeleton'
import { defaultCode, useCodeEditor } from '../use-code-editor'

type DeclarativeAmbientDefinition = Extract<AmbientDefinition, { kind: 'declarative' }>

type WorkingDraftPreviewProps = {
  ambientName: string
  definition: AmbientDefinition | null
  versionInUse: number | null
  versionInUseDefinition: AmbientDefinition | null
  canStartDraft: boolean
  onStartDraft: () => void
}

export function AmbientFramePreview({
  ambientName,
  definition,
  compact = false,
  editorHelpId: providedEditorHelpId,
  previewTitle,
}: {
  ambientName: string
  definition: DeclarativeAmbientDefinition
  compact?: boolean
  editorHelpId?: string
  previewTitle?: string
}) {
  const referenceWidth = compact ? 560 : 860
  const viewportRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(1)
  const generatedEditorHelpId = `${useId()}-editor-help`
  const editorHelpId = providedEditorHelpId ?? generatedEditorHelpId
  const { code, editorHostRef, isEditorReady, selectedLanguage } = useCodeEditor({
    languageId: 'typescript',
    ambientEditorExtension: definition.editorExtension,
    ariaDescribedBy: editorHelpId,
    initialCode: defaultCode,
    persistCode: false,
  })
  const content: ScreenshotContent = {
    title: previewTitle ?? `${ambientName} preview`,
    fileType: {
      id: selectedLanguage.id,
      label: selectedLanguage.label,
      syntax: selectedLanguage.lang,
    },
    lineCount: code.split('\n').length,
  }
  const ambientStyle = resolveAmbientVariables(definition, {})
  const frameStyle = {
    width: `${referenceWidth}px`,
    minWidth: `${referenceWidth}px`,
    zoom: previewScale,
    '--annotation-ink': definition.manifest.annotations.ink,
    ...ambientStyle,
  } as CSSProperties

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const updateScale = () => {
      const styles = getComputedStyle(viewport)
      const availableWidth = viewport.clientWidth
        - Number.parseFloat(styles.paddingLeft)
        - Number.parseFloat(styles.paddingRight)
      setPreviewScale(Math.min(1, availableWidth / referenceWidth))
    }
    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [referenceWidth])

  return (
    <>
      <div
        ref={viewportRef}
        className={compact ? 'workspace-preview-viewport workspace-comparison-preview' : 'workspace-preview-viewport'}
      >
        <div
          className="shot-frame workspace-preview-frame"
          data-export-gutter={definition.manifest.editor.exportGutter}
          style={frameStyle}
        >
          <DeclarativeAmbient
            compiledDocument={definition.compiledDocument}
            content={content}
            style={ambientStyle}
          >
            <div ref={editorHostRef} className="code-editor-host" slot="code">
              {!isEditorReady && <EditorSkeleton />}
            </div>
          </DeclarativeAmbient>
        </div>
      </div>
      {!providedEditorHelpId && (
        <span id={editorHelpId} className="sr-only">Representative code preview.</span>
      )}
    </>
  )
}

function DeclarativePreviewBlock({
  ambientName,
  definition,
  meta,
}: {
  ambientName: string
  definition: DeclarativeAmbientDefinition
  meta: string
}) {
  const editorHelpId = `${useId()}-editor-help`
  return (
    <>
      <div className="workspace-ambient-selector" aria-label={`${ambientName} ambient preview`}>
        <span className="workspace-selector-chevron workspace-selector-chevron-previous" aria-hidden="true" />
        <div className="workspace-ambient-identity">
          <AmbientIdentity
            definition={definition}
            meta={meta}
            name={ambientName}
          />
        </div>
        <span className="workspace-selector-chevron workspace-selector-chevron-next" aria-hidden="true" />
      </div>
      <AmbientFramePreview ambientName={ambientName} definition={definition} editorHelpId={editorHelpId} />
      <p id={editorHelpId} className="workspace-preview-help">
        Representative code rendered with the screenshot editor.
      </p>
    </>
  )
}

export function WorkingDraftPreview({
  ambientName,
  definition,
  versionInUse,
  versionInUseDefinition,
  canStartDraft,
  onStartDraft,
}: WorkingDraftPreviewProps) {
  if (!definition) {
    if (versionInUse !== null && versionInUseDefinition?.kind === 'declarative') {
      return (
        <DeclarativePreviewBlock
          ambientName={ambientName}
          definition={versionInUseDefinition}
          meta="Current version"
        />
      )
    }

    return (
      <div className="workspace-empty-state">
        <h2>No working draft</h2>
        <p>Start a draft to begin shaping this ambient.</p>
        <div className="workspace-empty-actions">
          <button className="ui-button ui-button-primary" type="button" disabled={!canStartDraft} onClick={onStartDraft}>
            Start a draft
          </button>
        </div>
      </div>
    )
  }

  if (definition.kind !== 'declarative') {
    return (
      <div className="workspace-error-state" role="alert">
        This draft cannot be rendered as a declarative ambient.
      </div>
    )
  }

  return <DeclarativePreviewBlock ambientName={ambientName} definition={definition} meta="Working draft" />
}
