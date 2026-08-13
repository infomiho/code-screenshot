import type { AmbientTokenPalette } from '../../schema'
import { createAmbientEditorExtension } from '../ambient-highlighting'
import type { AmbientDefinition, AmbientShellProps } from '../ambient-themes'

const tokens: AmbientTokenPalette = {
  text: 'oklch(0.93 0.014 255)',
  comment: 'oklch(0.64 0.025 257)',
  string: 'oklch(0.87 0.12 88)',
  keyword: 'oklch(0.69 0.085 292)',
  number: 'oklch(0.76 0.09 211)',
  function: 'oklch(0.72 0.17 43)',
  type: 'oklch(0.76 0.09 211)',
  punctuation: 'oklch(0.93 0.014 255)',
}

function TechnicalPlateShell({ content, children }: AmbientShellProps) {
  return (
    <div className="code-window">
      <div className="ambient-caption">{content.title || 'untitled'}</div>
      <div className="code-body">{children}</div>
    </div>
  )
}

export const technicalPlateAmbientDefinition = {
  id: 'technical-plate',
  version: 1,
  source: 'built-in',
  kind: 'react',
  manifest: {
    name: 'Technical plate',
    editor: { tokens, exportGutter: 'hide' },
    annotations: { ink: 'oklch(0.72 0.17 43)' },
    customizations: [],
  },
  frameClass: 'shot-frame--technical-plate',
  Shell: TechnicalPlateShell,
  editorExtension: createAmbientEditorExtension(tokens),
} satisfies AmbientDefinition
