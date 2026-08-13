import type { AmbientTokenPalette } from '../../schema'
import { createAmbientEditorExtension } from '../ambient-highlighting'
import type { AmbientDefinition, AmbientShellProps } from '../ambient-themes'

const tokens: AmbientTokenPalette = {
  text: 'oklch(0.86 0.12 145)',
  comment: 'oklch(0.63 0.075 145)',
  string: 'oklch(0.82 0.15 85)',
  keyword: 'oklch(0.78 0.12 205)',
  number: 'oklch(0.76 0.16 55)',
  function: 'oklch(0.8 0.15 145)',
  type: 'oklch(0.8 0.15 145)',
  punctuation: 'oklch(0.72 0.075 160)',
}

const padLineCount = (lineCount: number) => String(lineCount).padStart(3, '0')

function BareTerminalShell({ content, children }: AmbientShellProps) {
  return (
    <div className="code-window">
      <header className="terminal-header">
        <span className="terminal-power" aria-hidden="true"></span>
        <span>{content.title || 'TTY-01'}</span>
        <span>{content.fileType.label} / ONLINE</span>
      </header>
      <div className="code-body">{children}</div>
      <footer className="terminal-footer">
        <span>READY</span><span>UTF-8</span><span>{padLineCount(content.lineCount)} LN</span>
      </footer>
    </div>
  )
}

export const bareTerminalAmbientDefinition = {
  id: 'bare-terminal',
  version: 1,
  source: 'built-in',
  kind: 'react',
  manifest: {
    name: 'Bare-metal terminal',
    editor: { tokens, exportGutter: 'show' },
    annotations: { ink: 'oklch(0.82 0.15 85)' },
    customizations: [],
  },
  frameClass: 'shot-frame--bare-terminal',
  Shell: BareTerminalShell,
  editorExtension: createAmbientEditorExtension(tokens),
} satisfies AmbientDefinition
