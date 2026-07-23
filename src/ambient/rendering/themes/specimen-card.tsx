import type { AmbientTokenPalette } from '../../schema'
import { createAmbientEditorExtension } from '../ambient-highlighting'
import type { AmbientDefinition, AmbientShellProps } from '../ambient-themes'

const tokens: AmbientTokenPalette = {
  text: 'oklch(0.27 0.025 65)',
  comment: 'oklch(0.52 0.025 80)',
  string: 'oklch(0.45 0.12 145)',
  keyword: 'oklch(0.43 0.15 28)',
  number: 'oklch(0.44 0.11 255)',
  function: 'oklch(0.37 0.1 300)',
  type: 'oklch(0.37 0.1 300)',
  punctuation: 'oklch(0.44 0.02 70)',
}

const padLineCount = (lineCount: number) => String(lineCount).padStart(3, '0')

const fileTypeMarks: Record<string, string> = {
  bash: 'SH',
  css: 'CSS',
  html: 'HTML',
  javascript: 'JS',
  json: 'JSON',
  jsx: 'JSX',
  markdown: 'MD',
  python: 'PY',
  text: 'TXT',
  tsx: 'TSX',
  typescript: 'TS',
}

const getFileTypeMark = (fileTypeId: string) =>
  fileTypeMarks[fileTypeId] ?? fileTypeId.slice(0, 4).toUpperCase()

function SpecimenCardShell({ content, children }: AmbientShellProps) {
  return (
    <article className="code-window">
      <header className="specimen-header">
        <div className="specimen-kicker">Source archive / Digital specimen</div>
        <h2>{content.title || 'Untitled specimen'}</h2>
        <div className="specimen-accession">
          <span>{content.fileType.label}</span><span>No. {padLineCount(content.lineCount)}</span>
        </div>
      </header>
      <div className="code-body">{children}</div>
      <footer className="specimen-footer">
        <span>Classification: source code</span>
        <span>{padLineCount(content.lineCount)} lines</span>
        <i aria-label={`${content.fileType.label} specimen`}>{getFileTypeMark(content.fileType.id)}</i>
      </footer>
    </article>
  )
}

export const specimenCardAmbientDefinition = {
  id: 'specimen-card',
  version: 1,
  source: 'built-in',
  kind: 'react',
  manifest: {
    name: 'Specimen card',
    editor: { tokens, exportGutter: 'show' },
    annotations: { ink: 'oklch(0.5 0.16 28)' },
    customizations: [],
  },
  frameClass: 'shot-frame--specimen-card',
  Shell: SpecimenCardShell,
  editorExtension: createAmbientEditorExtension(tokens),
} satisfies AmbientDefinition
