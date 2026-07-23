import type { AmbientTokenPalette } from '../../schema'
import { createAmbientEditorExtension } from '../ambient-highlighting'
import type { AmbientDefinition, AmbientShellProps } from '../ambient-themes'

const tokens: AmbientTokenPalette = {
  text: 'oklch(0.29 0.025 80)',
  comment: 'oklch(0.53 0.035 95)',
  string: 'oklch(0.42 0.13 150)',
  keyword: 'oklch(0.44 0.15 25)',
  number: 'oklch(0.43 0.12 255)',
  function: 'oklch(0.37 0.11 300)',
  type: 'oklch(0.37 0.11 300)',
  punctuation: 'oklch(0.43 0.025 80)',
}

function FieldNotebookShell({ content, children }: AmbientShellProps) {
  return (
    <div className="code-window">
      <header className="notebook-header">
        <h2>{content.title || 'Field note'}</h2>
        <span>Entry 014 / {content.fileType.label}</span>
      </header>
      <div className="code-body">{children}</div>
    </div>
  )
}

export const fieldNotebookAmbientDefinition = {
  id: 'field-notebook',
  version: 1,
  source: 'built-in',
  kind: 'react',
  manifest: {
    name: 'Field notebook',
    editor: { tokens, exportGutter: 'hide' },
    annotations: { ink: 'oklch(0.44 0.15 25)' },
    customizations: [],
  },
  frameClass: 'shot-frame--field-notebook',
  Shell: FieldNotebookShell,
  editorExtension: createAmbientEditorExtension(tokens),
} satisfies AmbientDefinition
