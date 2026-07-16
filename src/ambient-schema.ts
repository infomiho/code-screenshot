export type ScreenshotContent = {
  title: string
  fileType: {
    id: string
    label: string
    syntax: string
  }
  lineCount: number
}

export type AmbientTokenPalette = {
  text: string
  comment: string
  string: string
  keyword: string
  number: string
  function: string
  type: string
  punctuation: string
}

export type AmbientPaletteSlot = {
  type: 'palette'
  id: string
  label: string
  cssVariable: `--ambient-${string}`
  valueKind: 'color' | 'paint'
  defaultOptionId: string
  options: readonly {
    id: string
    label: string
    value: string
  }[]
}

export type AmbientColorSlot = {
  type: 'color'
  id: string
  label: string
  cssVariable: `--ambient-${string}`
  defaultValue: string
}

export type AmbientCustomizationSlot = AmbientPaletteSlot | AmbientColorSlot

export type AmbientDocument = {
  schemaVersion: 1
  name: string
  editor: {
    tokens: AmbientTokenPalette
    exportGutter: 'show' | 'hide'
  }
  annotations: {
    ink: string
  }
  customizations: readonly AmbientCustomizationSlot[]
  template: string
  stylesheet: string
}

export type AmbientManifest = Omit<
  AmbientDocument,
  'schemaVersion' | 'template' | 'stylesheet'
>

export type AmbientDiagnostic = {
  severity: 'error' | 'warning'
  code: string
  path?: string
  message: string
}

export type AmbientTextSource = 'title' | 'fileTypeId' | 'fileTypeLabel' | 'lineCount'

export type AmbientTextBinding = {
  id: number
  source: AmbientTextSource
  format: 'plain' | 'pad-3'
  fallback?: string
  tooltip: boolean
}

export type CompiledAmbientDocument = {
  document: AmbientDocument
  template: string
  bindings: readonly AmbientTextBinding[]
}

export const ambientEditorVariables = [
  '--ambient-editor-background',
  '--ambient-editor-caret-color',
  '--ambient-editor-content-padding-inline',
  '--ambient-editor-font-family',
  '--ambient-editor-font-size',
  '--ambient-editor-font-weight',
  '--ambient-editor-gutter-color',
  '--ambient-editor-gutter-gap',
  '--ambient-editor-gutter-padding-inline-end',
  '--ambient-editor-highlight-accent',
  '--ambient-editor-highlight-background',
  '--ambient-editor-line-height',
  '--ambient-editor-selected-line-number-color',
  '--ambient-editor-selection-background',
  '--ambient-editor-text-color',
] as const

export const ambientTextSources: readonly AmbientTextSource[] = [
  'title',
  'fileTypeId',
  'fileTypeLabel',
  'lineCount',
]
