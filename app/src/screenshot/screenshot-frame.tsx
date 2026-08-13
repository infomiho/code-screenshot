import type { CSSProperties, ReactNode, RefCallback, RefObject } from 'react'
import { DeclarativeAmbient } from '../ambient/rendering/declarative-ambient'
import type { AmbientDefinition, ScreenshotContent } from '../ambient/rendering/ambient-themes'
import { EditorSkeleton } from './editor-skeleton'
import './screenshot-frame.css'

type ScreenshotFrameProps = {
  ambient: AmbientDefinition
  ambientVariables: CSSProperties
  children?: ReactNode
  content: ScreenshotContent
  editorHostRef: RefCallback<HTMLDivElement>
  frameRef?: RefObject<HTMLDivElement | null>
  isEditorReady: boolean
  isExporting?: boolean
  status?: 'resolving' | 'revealing' | 'ready'
  width: number
}

export function ScreenshotFrame({
  ambient,
  ambientVariables,
  children,
  content,
  editorHostRef,
  frameRef,
  isEditorReady,
  isExporting = false,
  status = 'ready',
  width,
}: ScreenshotFrameProps) {
  const SelectedAmbientShell = ambient.kind === 'react' ? ambient.Shell : null
  const frameClass = [
    'shot-frame',
    ambient.kind === 'react' ? ambient.frameClass : '',
    isExporting ? 'shot-frame--exporting' : '',
  ].filter(Boolean).join(' ')
  const frameStyle = {
    width: `${width}px`,
    '--annotation-ink': ambient.manifest.annotations.ink,
    ...(ambient.kind === 'react' ? ambientVariables : {}),
  } as CSSProperties
  const editor = (
    <div ref={editorHostRef} className="code-editor-host" slot={ambient.kind === 'declarative' ? 'code' : undefined}>
      {!isEditorReady && <EditorSkeleton />}
    </div>
  )

  return (
    <div
      ref={frameRef}
      className={frameClass}
      data-export-gutter={ambient.manifest.editor.exportGutter}
      data-frame-status={status}
      style={frameStyle}
    >
      {ambient.kind === 'declarative' ? (
        <DeclarativeAmbient
          compiledDocument={ambient.compiledDocument}
          content={content}
          style={ambientVariables}
        >
          {editor}
        </DeclarativeAmbient>
      ) : SelectedAmbientShell ? (
        <SelectedAmbientShell content={content}>{editor}</SelectedAmbientShell>
      ) : null}
      {children}
    </div>
  )
}
