import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import type { AmbientCustomizationSlot, AmbientTokenPalette } from '../../schema'
import type { AmbientDefinition, AmbientShellProps } from '../ambient-themes'

const tokens: AmbientTokenPalette = {
  text: '#333333',
  comment: '#999999',
  string: '#777777',
  keyword: '#b8941f',
  number: '#333333',
  function: '#333333',
  type: '#333333',
  punctuation: '#555555',
}

const highlightStyle = HighlightStyle.define([
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

export const macosAmbientDefinition = {
  id: 'macos',
  version: 1,
  source: 'built-in',
  kind: 'react',
  manifest: {
    name: 'macOS window',
    editor: { tokens, exportGutter: 'show' },
    annotations: { ink: '#f25f57' },
    customizations: [desktopBackdrop],
  },
  frameClass: 'shot-frame--macos',
  Shell: MacosShell,
  editorExtension: syntaxHighlighting(highlightStyle),
} satisfies AmbientDefinition
