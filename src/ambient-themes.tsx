import type { ComponentType, ReactNode } from 'react'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { tags } from '@lezer/highlight'
import './ambient-themes.css'

export type ScreenshotContent = {
  title: string
  fileType: {
    id: string
    label: string
    syntax: string
  }
  lineCount: number
}

type AmbientPaletteSlot = {
  type: 'palette'
  id: string
  label: string
  cssVariable: `--ambient-${string}`
  defaultOptionId: string
  options: readonly {
    id: string
    label: string
    value: string
  }[]
}

type AmbientColorSlot = {
  type: 'color'
  id: string
  label: string
  cssVariable: `--ambient-${string}`
  defaultValue: string
}

export type AmbientCustomizationSlot = AmbientPaletteSlot | AmbientColorSlot

export type AmbientManifest = {
  schemaVersion: 1
  id: string
  version: number
  name: string
  editor: {
    tokens: AmbientTokenPalette
  }
  customizations: readonly AmbientCustomizationSlot[]
}

export type AmbientTokenPalette = {
  text: string
  muted: string
  string: string
  keyword: string
  number: string
  function: string
  type: string
  punctuation: string
}

type AmbientShellProps = {
  content: ScreenshotContent
  children: ReactNode
}

export type AmbientDefinition = {
  manifest: AmbientManifest
  frameClass: string
  Shell: ComponentType<AmbientShellProps>
  editorExtension: Extension
  hideGutterOnExport?: boolean
}

export type AmbientCustomizationState = Record<string, Record<string, string>>

const createHighlightStyle = (colors: AmbientTokenPalette) =>
  HighlightStyle.define([
    { tag: tags.comment, color: colors.muted, fontStyle: 'italic' },
    { tag: [tags.string, tags.character, tags.heading, tags.regexp], color: colors.string },
    {
      tag: [tags.keyword, tags.atom, tags.bool, tags.operator, tags.modifier, tags.definitionKeyword],
      color: colors.keyword,
    },
    { tag: [tags.number, tags.variableName, tags.constant(tags.name)], color: colors.number },
    {
      tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
      color: colors.function,
      fontWeight: '700',
    },
    {
      tag: [tags.className, tags.typeName, tags.tagName, tags.attributeName],
      color: colors.type,
    },
    { tag: [tags.punctuation, tags.propertyName], color: colors.punctuation },
    { tag: tags.name, color: colors.text },
    { tag: tags.strong, fontWeight: '700' },
    { tag: tags.emphasis, fontStyle: 'italic' },
  ])

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
    tag: [
      tags.function(tags.variableName),
      tags.className,
      tags.typeName,
      tags.standard(tags.name),
    ],
    color: '#333333',
    fontWeight: '700',
  },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
])

const waspTokens: AmbientTokenPalette = {
  text: '#333333',
  muted: '#999999',
  string: '#777777',
  keyword: '#b8941f',
  number: '#333333',
  function: '#333333',
  type: '#333333',
  punctuation: '#555555',
}

const technicalPlateTokens: AmbientTokenPalette = {
  text: 'oklch(0.93 0.014 255)',
  muted: 'oklch(0.64 0.025 257)',
  string: 'oklch(0.87 0.12 88)',
  keyword: 'oklch(0.69 0.085 292)',
  number: 'oklch(0.76 0.09 211)',
  function: 'oklch(0.72 0.17 43)',
  type: 'oklch(0.76 0.09 211)',
  punctuation: 'oklch(0.93 0.014 255)',
}
const technicalPlateHighlightStyle = createHighlightStyle(technicalPlateTokens)

const specimenTokens: AmbientTokenPalette = {
  text: 'oklch(0.27 0.025 65)',
  muted: 'oklch(0.52 0.025 80)',
  string: 'oklch(0.45 0.12 145)',
  keyword: 'oklch(0.43 0.15 28)',
  number: 'oklch(0.44 0.11 255)',
  function: 'oklch(0.37 0.1 300)',
  type: 'oklch(0.37 0.1 300)',
  punctuation: 'oklch(0.44 0.02 70)',
}
const specimenHighlightStyle = createHighlightStyle(specimenTokens)

const swissTokens: AmbientTokenPalette = {
  text: 'oklch(0.205 0.012 65)',
  muted: 'oklch(0.53 0.018 72)',
  string: 'oklch(0.43 0.095 148)',
  keyword: 'oklch(0.42 0.125 252)',
  number: 'oklch(0.48 0.105 72)',
  function: 'oklch(0.255 0.025 285)',
  type: 'oklch(0.42 0.125 252)',
  punctuation: 'oklch(0.205 0.012 65)',
}
const swissHighlightStyle = createHighlightStyle(swissTokens)

const notebookTokens: AmbientTokenPalette = {
  text: 'oklch(0.29 0.025 80)',
  muted: 'oklch(0.53 0.035 95)',
  string: 'oklch(0.42 0.13 150)',
  keyword: 'oklch(0.44 0.15 25)',
  number: 'oklch(0.43 0.12 255)',
  function: 'oklch(0.37 0.11 300)',
  type: 'oklch(0.37 0.11 300)',
  punctuation: 'oklch(0.43 0.025 80)',
}
const notebookHighlightStyle = createHighlightStyle(notebookTokens)

const terminalTokens: AmbientTokenPalette = {
  text: 'oklch(0.86 0.12 145)',
  muted: 'oklch(0.63 0.075 145)',
  string: 'oklch(0.82 0.15 85)',
  keyword: 'oklch(0.78 0.12 205)',
  number: 'oklch(0.76 0.16 55)',
  function: 'oklch(0.8 0.15 145)',
  type: 'oklch(0.8 0.15 145)',
  punctuation: 'oklch(0.72 0.075 160)',
}
const terminalHighlightStyle = createHighlightStyle(terminalTokens)

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

const getFileTypeMark = (fileTypeId: string) => fileTypeMarks[fileTypeId] ?? fileTypeId.slice(0, 4).toUpperCase()

function MacosShell({ content, children }: AmbientShellProps) {
  return (
    <div className="code-window">
      <header className="window-bar">
        <div className="window-dots" aria-hidden="true"><span></span><span></span><span></span></div>
        <span className="window-title">{content.title || 'Untitled'}</span>
        <span className="window-language">{content.fileType.label}</span>
      </header>
      <div className="code-body">{children}</div>
    </div>
  )
}

function TechnicalPlateShell({ content, children }: AmbientShellProps) {
  return (
    <div className="code-window">
      <div className="ambient-caption">{content.title || 'untitled'}</div>
      <div className="code-body">{children}</div>
    </div>
  )
}

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

function SwissPosterShell({ content, children }: AmbientShellProps) {
  return (
    <article className="code-window">
      <header className="swiss-header">
        <div className="swiss-title">
          <span className="swiss-label">Title</span>
          <h2 title={content.title}>{content.title || 'Untitled'}</h2>
        </div>
      </header>
      <div className="code-body">{children}</div>
      <footer className="swiss-footer">
        <div className="swiss-meta"><span className="swiss-label">File type</span><span className="swiss-value">{content.fileType.label}</span></div>
        <div className="swiss-meta"><span className="swiss-label">Lines</span><span className="swiss-value">{padLineCount(content.lineCount)}</span></div>
      </footer>
    </article>
  )
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

const desktopBackdrop: AmbientCustomizationSlot = {
  type: 'palette',
  id: 'desktopBackdrop',
  label: 'Desktop background',
  cssVariable: '--ambient-desktop-backdrop',
  defaultOptionId: 'yellow',
  options: [
    { id: 'yellow', label: 'Wasp yellow', value: '#f5c842' },
    { id: 'blue', label: 'Blue', value: 'linear-gradient(135deg, oklch(0.615 0.081 262), oklch(0.83 0.037 261))' },
    { id: 'lilac', label: 'Lilac', value: 'linear-gradient(135deg, oklch(0.83 0.062 44), oklch(0.852 0.068 292))' },
    { id: 'sand', label: 'Sand', value: 'linear-gradient(135deg, oklch(0.703 0.071 36), oklch(0.766 0.09 58))' },
    { id: 'rose', label: 'Rose', value: 'linear-gradient(135deg, oklch(0.913 0.031 270), oklch(0.765 0.059 19))' },
    { id: 'midnight', label: 'Midnight', value: 'linear-gradient(135deg, oklch(0.442 0.07 240), oklch(0.418 0.084 292))' },
    { id: 'graphite', label: 'Graphite', value: 'oklch(0.28 0.012 250)' },
  ],
}

const posterGround: AmbientCustomizationSlot = {
  type: 'palette',
  id: 'posterGround',
  label: 'Poster ground',
  cssVariable: '--ambient-poster-ground',
  defaultOptionId: 'signal-red',
  options: [
    { id: 'signal-red', label: 'Signal red', value: 'oklch(0.58 0.22 28)' },
    { id: 'cobalt', label: 'Cobalt', value: 'oklch(0.55 0.145 252)' },
    { id: 'fir', label: 'Fir', value: 'oklch(0.48 0.105 155)' },
    { id: 'ochre', label: 'Ochre', value: 'oklch(0.72 0.13 82)' },
    { id: 'plum', label: 'Plum', value: 'oklch(0.46 0.105 325)' },
  ],
}

const defineAmbient = (definition: AmbientDefinition) => definition

export const ambientDefinitions: AmbientDefinition[] = [
  defineAmbient({
    manifest: { schemaVersion: 1, id: 'macos', version: 1, name: 'macOS window', editor: { tokens: waspTokens }, customizations: [desktopBackdrop] },
    frameClass: 'shot-frame--macos',
    Shell: MacosShell,
    editorExtension: syntaxHighlighting(waspHighlightStyle),
  }),
  defineAmbient({
    manifest: { schemaVersion: 1, id: 'technical-plate', version: 1, name: 'Technical plate', editor: { tokens: technicalPlateTokens }, customizations: [] },
    frameClass: 'shot-frame--technical-plate',
    Shell: TechnicalPlateShell,
    editorExtension: syntaxHighlighting(technicalPlateHighlightStyle),
    hideGutterOnExport: true,
  }),
  defineAmbient({
    manifest: { schemaVersion: 1, id: 'specimen-card', version: 1, name: 'Specimen card', editor: { tokens: specimenTokens }, customizations: [] },
    frameClass: 'shot-frame--specimen-card',
    Shell: SpecimenCardShell,
    editorExtension: syntaxHighlighting(specimenHighlightStyle),
  }),
  defineAmbient({
    manifest: { schemaVersion: 1, id: 'swiss-poster', version: 2, name: 'Swiss poster', editor: { tokens: swissTokens }, customizations: [posterGround] },
    frameClass: 'shot-frame--swiss-poster',
    Shell: SwissPosterShell,
    editorExtension: syntaxHighlighting(swissHighlightStyle),
  }),
  defineAmbient({
    manifest: { schemaVersion: 1, id: 'field-notebook', version: 1, name: 'Field notebook', editor: { tokens: notebookTokens }, customizations: [] },
    frameClass: 'shot-frame--field-notebook',
    Shell: FieldNotebookShell,
    editorExtension: syntaxHighlighting(notebookHighlightStyle),
    hideGutterOnExport: true,
  }),
  defineAmbient({
    manifest: { schemaVersion: 1, id: 'bare-terminal', version: 1, name: 'Bare-metal terminal', editor: { tokens: terminalTokens }, customizations: [] },
    frameClass: 'shot-frame--bare-terminal',
    Shell: BareTerminalShell,
    editorExtension: syntaxHighlighting(terminalHighlightStyle),
  }),
]

export const getAmbientKey = (definition: AmbientDefinition) =>
  `${definition.manifest.id}@${definition.manifest.version}`

export const defaultAmbientKey = getAmbientKey(ambientDefinitions[0])

export const getAmbientDefinition = (id: string) => {
  const definition = ambientDefinitions.find((candidate) => getAmbientKey(candidate) === id)

  if (!definition) throw new Error(`Unknown ambient: ${id}`)
  return definition
}

export const resolveAmbientVariables = (
  definition: AmbientDefinition,
  state: AmbientCustomizationState,
) =>
  Object.fromEntries(
    definition.manifest.customizations.map((slot) => {
      const selectedValue = state[getAmbientKey(definition)]?.[slot.id]

      if (slot.type === 'color') {
        return [slot.cssVariable, selectedValue ?? slot.defaultValue]
      }

      const selectedOption = slot.options.find((option) => option.id === selectedValue)
      const defaultOption = slot.options.find((option) => option.id === slot.defaultOptionId)

      if (!defaultOption) throw new Error(`Missing default option for ${slot.id}`)
      return [slot.cssVariable, selectedOption?.value ?? defaultOption.value]
    }),
  )
