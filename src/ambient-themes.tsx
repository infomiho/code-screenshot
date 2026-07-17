import type { ComponentType, ReactNode } from 'react'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { tags } from '@lezer/highlight'
import './ambient-themes.css'
import type {
  AmbientCustomizationSlot,
  AmbientManifest,
  AmbientTokenPalette,
  CompiledAmbientDocument,
  ScreenshotContent,
} from './ambient-schema'
import { compiledSwissPoster, swissPosterDocument } from './swiss-poster'

export type {
  AmbientCustomizationSlot,
  AmbientManifest,
  AmbientTokenPalette,
  ScreenshotContent,
} from './ambient-schema'

type AmbientShellProps = {
  content: ScreenshotContent
  children: ReactNode
}

type AmbientDefinitionBase = {
  id: string
  version: number
  source: 'built-in' | 'draft' | 'saved'
  manifest: AmbientManifest
  editorExtension: Extension
}

type ReactAmbientDefinition = AmbientDefinitionBase & {
  kind: 'react'
  frameClass: string
  Shell: ComponentType<AmbientShellProps>
}

type DeclarativeAmbientDefinition = AmbientDefinitionBase & {
  kind: 'declarative'
  compiledDocument: CompiledAmbientDocument
}

export type AmbientDefinition = ReactAmbientDefinition | DeclarativeAmbientDefinition

export type AmbientCustomizationState = Record<string, Record<string, string>>

const createHighlightStyle = (colors: AmbientTokenPalette) =>
  HighlightStyle.define([
    { tag: tags.comment, color: colors.comment, fontStyle: 'italic' },
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

export const createAmbientEditorExtension = (colors: AmbientTokenPalette) =>
  syntaxHighlighting(createHighlightStyle(colors))

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
  comment: '#999999',
  string: '#777777',
  keyword: '#b8941f',
  number: '#333333',
  function: '#333333',
  type: '#333333',
  punctuation: '#555555',
}

const technicalPlateTokens: AmbientTokenPalette = {
  text: 'oklch(0.93 0.014 255)',
  comment: 'oklch(0.64 0.025 257)',
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
  comment: 'oklch(0.52 0.025 80)',
  string: 'oklch(0.45 0.12 145)',
  keyword: 'oklch(0.43 0.15 28)',
  number: 'oklch(0.44 0.11 255)',
  function: 'oklch(0.37 0.1 300)',
  type: 'oklch(0.37 0.1 300)',
  punctuation: 'oklch(0.44 0.02 70)',
}
const specimenHighlightStyle = createHighlightStyle(specimenTokens)

const notebookTokens: AmbientTokenPalette = {
  text: 'oklch(0.29 0.025 80)',
  comment: 'oklch(0.53 0.035 95)',
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
  comment: 'oklch(0.63 0.075 145)',
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
  id: 'desktop-backdrop',
  label: 'Desktop background',
  cssVariable: '--ambient-desktop-backdrop',
  valueKind: 'paint',
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

const defineAmbient = (definition: AmbientDefinition) => definition

const createManifest = (
  name: string,
  tokens: AmbientTokenPalette,
  annotationInk: string,
  exportGutter: 'show' | 'hide' = 'show',
  customizations: readonly AmbientCustomizationSlot[] = [],
): AmbientManifest => ({
  name,
  editor: { tokens, exportGutter },
  annotations: { ink: annotationInk },
  customizations,
})

const swissPosterManifest: AmbientManifest = {
  name: swissPosterDocument.name,
  editor: swissPosterDocument.editor,
  annotations: swissPosterDocument.annotations,
  customizations: swissPosterDocument.customizations,
}

export const ambientDefinitions: readonly AmbientDefinition[] = [
  defineAmbient({
    id: 'macos',
    version: 1,
    source: 'built-in',
    kind: 'react',
    manifest: createManifest('macOS window', waspTokens, '#f25f57', 'show', [desktopBackdrop]),
    frameClass: 'shot-frame--macos',
    Shell: MacosShell,
    editorExtension: syntaxHighlighting(waspHighlightStyle),
  }),
  defineAmbient({
    id: 'technical-plate',
    version: 1,
    source: 'built-in',
    kind: 'react',
    manifest: createManifest('Technical plate', technicalPlateTokens, 'oklch(0.72 0.17 43)', 'hide'),
    frameClass: 'shot-frame--technical-plate',
    Shell: TechnicalPlateShell,
    editorExtension: syntaxHighlighting(technicalPlateHighlightStyle),
  }),
  defineAmbient({
    id: 'specimen-card',
    version: 1,
    source: 'built-in',
    kind: 'react',
    manifest: createManifest('Specimen card', specimenTokens, 'oklch(0.5 0.16 28)'),
    frameClass: 'shot-frame--specimen-card',
    Shell: SpecimenCardShell,
    editorExtension: syntaxHighlighting(specimenHighlightStyle),
  }),
  defineAmbient({
    id: 'swiss-poster',
    version: 2,
    source: 'built-in',
    kind: 'declarative',
    manifest: swissPosterManifest,
    compiledDocument: compiledSwissPoster,
    editorExtension: createAmbientEditorExtension(swissPosterDocument.editor.tokens),
  }),
  defineAmbient({
    id: 'field-notebook',
    version: 1,
    source: 'built-in',
    kind: 'react',
    manifest: createManifest('Field notebook', notebookTokens, 'oklch(0.44 0.15 25)', 'hide'),
    frameClass: 'shot-frame--field-notebook',
    Shell: FieldNotebookShell,
    editorExtension: syntaxHighlighting(notebookHighlightStyle),
  }),
  defineAmbient({
    id: 'bare-terminal',
    version: 1,
    source: 'built-in',
    kind: 'react',
    manifest: createManifest('Bare-metal terminal', terminalTokens, 'oklch(0.82 0.15 85)'),
    frameClass: 'shot-frame--bare-terminal',
    Shell: BareTerminalShell,
    editorExtension: syntaxHighlighting(terminalHighlightStyle),
  }),
]

export const getAmbientKey = (definition: AmbientDefinition) =>
  `${definition.id}@${definition.version}`

export const defaultAmbientKey = getAmbientKey(ambientDefinitions[0])

export const getAmbientDefinition = (
  id: string,
  definitions: readonly AmbientDefinition[] = ambientDefinitions,
) => {
  const definition = definitions.find((candidate) => getAmbientKey(candidate) === id)

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
