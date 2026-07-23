import { generate, lexer, parse as parseCss, walk, type CssNode, type Declaration, type Rule } from 'css-tree'
import {
  parseFragment,
  serialize,
  type DefaultTreeAdapterTypes,
  type ParserError,
} from 'parse5'
import {
  ambientEditorVariables,
  ambientTextSources,
  type AmbientCustomizationSlot,
  type AmbientDiagnostic,
  type AmbientDocument,
  type AmbientTextBinding,
  type AmbientTextSource,
  type CompiledAmbientDocument,
} from './schema'
import { validateRasterDataUrl } from './raster-data-url'
import { compileAmbientThumbnail } from './thumbnail'

type JsonObject = Record<string, unknown>
type HtmlNode = DefaultTreeAdapterTypes.ChildNode
type HtmlElement = DefaultTreeAdapterTypes.Element

const documentKeys = [
  'schemaVersion',
  'name',
  'editor',
  'annotations',
  'customizations',
  'template',
  'stylesheet',
  'thumbnail',
]
const thumbnailKeys = ['template', 'stylesheet']
const editorKeys = ['tokens', 'exportGutter']
const tokenKeys = ['text', 'comment', 'string', 'keyword', 'number', 'function', 'type', 'punctuation']
const annotationKeys = ['ink']
const paletteKeys = ['type', 'id', 'label', 'cssVariable', 'valueKind', 'defaultOptionId', 'options']
const colorKeys = ['type', 'id', 'label', 'cssVariable', 'defaultValue']
const optionKeys = ['id', 'label', 'value']
const allowedElements = new Set(['article', 'div', 'footer', 'h2', 'header', 'section', 'span'])
const allowedEditorVariables = new Set<string>(ambientEditorVariables)
const allowedGradientFunctions = new Set([
  'conic-gradient',
  'linear-gradient',
  'radial-gradient',
  'repeating-conic-gradient',
  'repeating-linear-gradient',
  'repeating-radial-gradient',
])
const allowedPaintFunctions = new Set([
  ...allowedGradientFunctions,
  'calc',
  'clamp',
  'color',
  'color-mix',
  'hsl',
  'hsla',
  'lab',
  'lch',
  'max',
  'min',
  'oklab',
  'oklch',
  'rgb',
  'rgba',
])
const idPattern = /^[a-z][a-z0-9-]{0,63}$/
const classListPattern = /^[a-z][a-z0-9-]*(?: [a-z][a-z0-9-]*)*$/
const customizationVariablePattern = /^--ambient-[a-z][a-z0-9-]*$/
const editorVariablePattern = /--ambient-editor-[a-z-]+/g
const editorColorVariables = new Set([
  '--ambient-editor-background',
  '--ambient-editor-caret-color',
  '--ambient-editor-gutter-color',
  '--ambient-editor-highlight-accent',
  '--ambient-editor-highlight-background',
  '--ambient-editor-selected-line-number-color',
  '--ambient-editor-selection-background',
  '--ambient-editor-text-color',
])
const editorLengthVariables = new Map<string, readonly [number, number]>([
  ['--ambient-editor-content-padding-inline', [0, 32]],
  ['--ambient-editor-font-size', [8, 32]],
  ['--ambient-editor-gutter-gap', [0, 48]],
  ['--ambient-editor-gutter-padding-inline-end', [0, 32]],
] as const)
const externalResourceFunctions = new Set(['-webkit-image-set', 'cross-fade', 'element', 'image-set'])
const maxTemplateBytes = 64 * 1024
const maxStylesheetBytes = 96 * 1024
const maxTemplateDepth = 32
const maxTemplateNodes = 512
const maxThumbnailTemplateBytes = 2 * 1024
const maxThumbnailStylesheetBytes = 4 * 1024
const maxDocumentBytes = 192 * 1024
const byteLength = (value: string) => new TextEncoder().encode(value).byteLength
const sizeLimitMessage = (label: string, current: number, maximum: number) =>
  `${label} is ${current} bytes; maximum is ${maximum} bytes.`

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isElement = (node: HtmlNode): node is HtmlElement => 'tagName' in node

const addDiagnostic = (
  diagnostics: AmbientDiagnostic[],
  code: string,
  message: string,
  path?: string,
) => diagnostics.push({ severity: 'error', code, path, message })

const validateKeys = (
  value: unknown,
  keys: readonly string[],
  path: string,
  diagnostics: AmbientDiagnostic[],
) => {
  if (!isObject(value)) {
    addDiagnostic(diagnostics, 'document.invalid-type', 'Expected an object.', path)
    return false
  }

  for (const key of keys) {
    if (!(key in value)) {
      addDiagnostic(diagnostics, 'document.missing-field', `Missing field: ${key}.`, `${path}/${key}`)
    }
  }

  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) {
      addDiagnostic(diagnostics, 'document.unknown-field', `Unknown field: ${key}.`, `${path}/${key}`)
    }
  }

  return true
}

const validateString = (
  value: unknown,
  path: string,
  diagnostics: AmbientDiagnostic[],
  maximumLength = 120,
) => {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximumLength) {
    addDiagnostic(
      diagnostics,
      'value.invalid',
      `Expected a string between 1 and ${maximumLength} characters.`,
      path,
    )
    return false
  }

  return true
}

const parseCssValue = (value: string) => {
  try {
    return parseCss(value, { context: 'value', parseCustomProperty: true })
  } catch {
    return null
  }
}

const isColor = (value: string) => lexer.matchProperty('color', value).error === null

const isPaint = (value: string) => {
  if (isColor(value)) return true
  if (lexer.matchProperty('background', value).error !== null) return false

  const ast = parseCssValue(value)
  if (!ast) return false

  let hasGradient = false
  let isAllowed = true

  walk(ast, (node) => {
    if (node.type === 'Url') isAllowed = false
    if (node.type !== 'Function') return

    const functionName = node.name.toLowerCase()
    if (allowedGradientFunctions.has(functionName)) hasGradient = true
    if (!allowedPaintFunctions.has(functionName)) isAllowed = false
  })

  return isAllowed && hasGradient
}

const validateTokens = (value: unknown, diagnostics: AmbientDiagnostic[]) => {
  if (!validateKeys(value, tokenKeys, '/editor/tokens', diagnostics) || !isObject(value)) return

  for (const key of tokenKeys) {
    const tokenValue = value[key]
    if (typeof tokenValue !== 'string' || !isColor(tokenValue)) {
      addDiagnostic(
        diagnostics,
        'value.invalid',
        'Expected a CSS color.',
        `/editor/tokens/${key}`,
      )
    }
  }
}

const validateCustomization = (
  value: unknown,
  index: number,
  diagnostics: AmbientDiagnostic[],
) => {
  const path = `/customizations/${index}`
  if (!isObject(value)) {
    addDiagnostic(diagnostics, 'document.invalid-type', 'Expected an object.', path)
    return null
  }

  const keys = value.type === 'palette' ? paletteKeys : colorKeys
  if (!validateKeys(value, keys, path, diagnostics)) return null

  validateString(value.id, `${path}/id`, diagnostics, 64)
  validateString(value.label, `${path}/label`, diagnostics, 80)

  if (typeof value.id === 'string' && !idPattern.test(value.id)) {
    addDiagnostic(diagnostics, 'value.invalid', 'Expected a lowercase kebab-case ID.', `${path}/id`)
  }

  if (typeof value.cssVariable !== 'string' || !customizationVariablePattern.test(value.cssVariable)) {
    addDiagnostic(
      diagnostics,
      'value.invalid',
      'Expected a custom property with the --ambient- prefix.',
      `${path}/cssVariable`,
    )
  }

  if (value.type === 'color') {
    if (typeof value.defaultValue !== 'string' || !isColor(value.defaultValue)) {
      addDiagnostic(diagnostics, 'value.invalid', 'Expected a CSS color.', `${path}/defaultValue`)
    }
    return value as unknown as AmbientCustomizationSlot
  }

  if (value.type !== 'palette') {
    addDiagnostic(diagnostics, 'value.invalid', 'Expected palette or color.', `${path}/type`)
    return null
  }

  if (value.valueKind !== 'color' && value.valueKind !== 'paint') {
    addDiagnostic(diagnostics, 'value.invalid', 'Expected color or paint.', `${path}/valueKind`)
  }
  validateString(value.defaultOptionId, `${path}/defaultOptionId`, diagnostics, 64)

  if (!Array.isArray(value.options) || value.options.length === 0 || value.options.length > 32) {
    addDiagnostic(diagnostics, 'value.invalid', 'Expected between 1 and 32 options.', `${path}/options`)
    return value as unknown as AmbientCustomizationSlot
  }

  const optionIds = new Set<string>()
  for (const [optionIndex, option] of value.options.entries()) {
    const optionPath = `${path}/options/${optionIndex}`
    if (!validateKeys(option, optionKeys, optionPath, diagnostics) || !isObject(option)) continue

    validateString(option.id, `${optionPath}/id`, diagnostics, 64)
    validateString(option.label, `${optionPath}/label`, diagnostics, 80)
    if (typeof option.id === 'string') {
      if (optionIds.has(option.id)) {
        addDiagnostic(diagnostics, 'customization.duplicate-id', 'Option IDs must be unique.', `${optionPath}/id`)
      }
      optionIds.add(option.id)
    }

    const validValue = typeof option.value === 'string'
      && (value.valueKind === 'color' ? isColor(option.value) : isPaint(option.value))
    if (!validValue) {
      addDiagnostic(
        diagnostics,
        'value.invalid',
        `Expected a valid ${String(value.valueKind)} value without external resources.`,
        `${optionPath}/value`,
      )
    }
  }

  if (typeof value.defaultOptionId === 'string' && !optionIds.has(value.defaultOptionId)) {
    addDiagnostic(
      diagnostics,
      'customization.default-missing',
      'The default option must reference a declared option.',
      `${path}/defaultOptionId`,
    )
  }

  return value as unknown as AmbientCustomizationSlot
}

const validateDocument = (value: unknown, diagnostics: AmbientDiagnostic[]): value is AmbientDocument => {
  if (!validateKeys(value, documentKeys, '', diagnostics) || !isObject(value)) return false

  const documentBytes = byteLength(JSON.stringify(value))
  if (documentBytes > maxDocumentBytes) {
    addDiagnostic(diagnostics, 'document.size-limit', sizeLimitMessage('Document', documentBytes, maxDocumentBytes), '/')
  }

  if (value.schemaVersion !== 1) {
    addDiagnostic(diagnostics, 'schema.unsupported', 'Only schema version 1 is supported.', '/schemaVersion')
  }
  validateString(value.name, '/name', diagnostics, 80)

  if (validateKeys(value.editor, editorKeys, '/editor', diagnostics) && isObject(value.editor)) {
    validateTokens(value.editor.tokens, diagnostics)
    if (value.editor.exportGutter !== 'show' && value.editor.exportGutter !== 'hide') {
      addDiagnostic(diagnostics, 'value.invalid', 'Expected show or hide.', '/editor/exportGutter')
    }
  }

  if (validateKeys(value.annotations, annotationKeys, '/annotations', diagnostics) && isObject(value.annotations)) {
    if (typeof value.annotations.ink !== 'string' || !isColor(value.annotations.ink)) {
      addDiagnostic(diagnostics, 'value.invalid', 'Expected a CSS color.', '/annotations/ink')
    }
  }

  if (!Array.isArray(value.customizations) || value.customizations.length > 16) {
    addDiagnostic(diagnostics, 'value.invalid', 'Expected at most 16 customizations.', '/customizations')
  } else {
    const ids = new Set<string>()
    const variables = new Set<string>()
    for (const [index, customization] of value.customizations.entries()) {
      const validated = validateCustomization(customization, index, diagnostics)
      if (!validated) continue

      if (ids.has(validated.id)) {
        addDiagnostic(diagnostics, 'customization.duplicate-id', 'Customization IDs must be unique.', `/customizations/${index}/id`)
      }
      if (variables.has(validated.cssVariable)) {
        addDiagnostic(diagnostics, 'customization.duplicate-variable', 'Customization variables must be unique.', `/customizations/${index}/cssVariable`)
      }
      ids.add(validated.id)
      variables.add(validated.cssVariable)
    }
  }

  if (typeof value.template !== 'string' || byteLength(value.template) > maxTemplateBytes) {
    const current = typeof value.template === 'string' ? byteLength(value.template) : 0
    addDiagnostic(diagnostics, 'template.limit-exceeded', sizeLimitMessage('Template', current, maxTemplateBytes), '/template')
  }
  if (typeof value.stylesheet !== 'string' || byteLength(value.stylesheet) > maxStylesheetBytes) {
    const current = typeof value.stylesheet === 'string' ? byteLength(value.stylesheet) : 0
    addDiagnostic(diagnostics, 'stylesheet.limit-exceeded', sizeLimitMessage('Stylesheet', current, maxStylesheetBytes), '/stylesheet')
  }
  if (validateKeys(value.thumbnail, thumbnailKeys, '/thumbnail', diagnostics) && isObject(value.thumbnail)) {
    if (
      typeof value.thumbnail.template !== 'string'
      || byteLength(value.thumbnail.template) > maxThumbnailTemplateBytes
    ) {
      addDiagnostic(
        diagnostics,
        'thumbnail.template-limit',
        sizeLimitMessage(
          'Thumbnail template',
          typeof value.thumbnail.template === 'string' ? byteLength(value.thumbnail.template) : 0,
          maxThumbnailTemplateBytes,
        ),
        '/thumbnail/template',
      )
    }
    if (
      typeof value.thumbnail.stylesheet !== 'string'
      || byteLength(value.thumbnail.stylesheet) > maxThumbnailStylesheetBytes
    ) {
      addDiagnostic(
        diagnostics,
        'thumbnail.stylesheet-limit',
        sizeLimitMessage(
          'Thumbnail stylesheet',
          typeof value.thumbnail.stylesheet === 'string' ? byteLength(value.thumbnail.stylesheet) : 0,
          maxThumbnailStylesheetBytes,
        ),
        '/thumbnail/stylesheet',
      )
    }
  }

  return diagnostics.length === 0
}

const compileTemplate = (
  template: string,
  diagnostics: AmbientDiagnostic[],
) => {
  const parseErrors: ParserError[] = []
  const fragment = parseFragment(template, {
    onParseError: (error) => parseErrors.push(error),
  })
  for (const error of parseErrors) {
    addDiagnostic(diagnostics, 'template.parse', `Invalid HTML: ${error.code}.`, '/template')
  }

  const rootNodes = fragment.childNodes.filter((node) =>
    !('value' in node) || node.value.trim().length > 0,
  )
  if (rootNodes.length !== 1 || !isElement(rootNodes[0])) {
    addDiagnostic(diagnostics, 'template.root-count', 'Template must contain one root element.', '/template')
  }

  const bindings: AmbientTextBinding[] = []
  let codeSlotCount = 0
  let nodeCount = 0

  const visit = (node: HtmlNode, depth: number) => {
    nodeCount += 1
    if (nodeCount > maxTemplateNodes || depth > maxTemplateDepth) {
      addDiagnostic(diagnostics, 'template.limit-exceeded', 'Template structure is too complex.', '/template')
      return
    }

    if (node.nodeName === '#comment' || node.nodeName === '#documentType') {
      addDiagnostic(diagnostics, 'template.element-not-allowed', 'Comments and document types are not allowed.', '/template')
      return
    }
    if ('value' in node) {
      if (node.value.length > 8 * 1024) {
        addDiagnostic(diagnostics, 'template.limit-exceeded', 'Static text is too long.', '/template')
      }
      return
    }
    if (!isElement(node)) return

    if (node.tagName === 'ambient-slot') {
      const attributes = Object.fromEntries(node.attrs.map((attribute) => [attribute.name, attribute.value]))
      const unknownAttributes = node.attrs.filter((attribute) =>
        !['name', 'format', 'fallback', 'tooltip'].includes(attribute.name),
      )
      if (unknownAttributes.length > 0) {
        addDiagnostic(diagnostics, 'template.attribute-not-allowed', 'Slot contains an unknown attribute.', '/template')
      }

      const source = attributes.name
      if (source === 'code') {
        codeSlotCount += 1
        if (attributes.format || attributes.fallback || 'tooltip' in attributes || node.childNodes.length > 0) {
          addDiagnostic(diagnostics, 'template.attribute-not-allowed', 'The code slot accepts only its name.', '/template')
        }
        node.tagName = 'slot'
        node.nodeName = 'slot'
        node.attrs = [{ name: 'name', value: 'code' }]
        node.childNodes = []
        return
      }

      if (!ambientTextSources.includes(source as AmbientTextSource)) {
        addDiagnostic(diagnostics, 'template.slot-unknown', `Unknown slot: ${String(source)}.`, '/template')
        return
      }

      const format = attributes.format || 'plain'
      if (format !== 'plain' && format !== 'pad-3') {
        addDiagnostic(diagnostics, 'template.format-invalid', `Unknown format: ${format}.`, '/template')
      }
      if (format === 'pad-3' && source !== 'lineCount') {
        addDiagnostic(diagnostics, 'template.format-invalid', 'pad-3 is only valid for lineCount.', '/template')
      }
      if (attributes.fallback && attributes.fallback.length > 120) {
        addDiagnostic(diagnostics, 'template.limit-exceeded', 'Fallback text is too long.', '/template')
      }
      if (node.childNodes.length > 0) {
        addDiagnostic(diagnostics, 'template.element-not-allowed', 'Text slots cannot contain children.', '/template')
      }

      const binding: AmbientTextBinding = {
        id: bindings.length,
        source: source as AmbientTextSource,
        format: format === 'pad-3' ? 'pad-3' : 'plain',
        fallback: attributes.fallback,
        tooltip: 'tooltip' in attributes,
      }
      bindings.push(binding)
      node.tagName = 'span'
      node.nodeName = 'span'
      node.attrs = [{ name: 'data-ambient-binding', value: String(binding.id) }]
      node.childNodes = []
      return
    }

    if (!allowedElements.has(node.tagName)) {
      addDiagnostic(diagnostics, 'template.element-not-allowed', `Element is not allowed: ${node.tagName}.`, '/template')
    }
    for (const attribute of node.attrs) {
      if (attribute.name !== 'class' || !classListPattern.test(attribute.value)) {
        addDiagnostic(diagnostics, 'template.attribute-not-allowed', `Attribute is not allowed: ${attribute.name}.`, '/template')
      }
    }
    for (const child of node.childNodes) visit(child, depth + 1)
  }

  for (const node of fragment.childNodes) visit(node, 1)
  if (codeSlotCount !== 1) {
    addDiagnostic(diagnostics, 'template.code-slot-count', 'Template must contain exactly one code slot.', '/template')
  }

  return { bindings, template: serialize(fragment) }
}

const validateSlottedRule = (rule: Rule, diagnostics: AmbientDiagnostic[]) => {
  const selector = generate(rule.prelude).replaceAll(/\s|["']/g, '')
  const isCodeSlot = selector === '::slotted([slot=code])'
  if (!isCodeSlot) {
    addDiagnostic(diagnostics, 'stylesheet.slotted-selector', 'Only the code slot may use ::slotted.', '/stylesheet')
  }

  for (const child of rule.block.children) {
    if (
      child.type !== 'Declaration'
      || child.important
      || !allowedEditorVariables.has(child.property)
    ) {
      addDiagnostic(
        diagnostics,
        'stylesheet.slotted-declaration',
        'Slotted rules may set only documented editor variables.',
        '/stylesheet',
      )
      continue
    }

    const value = generate(child.value)
    let isValid = true
    if (editorColorVariables.has(child.property)) {
      isValid = isColor(value)
    } else if (editorLengthVariables.has(child.property)) {
      const bounds = editorLengthVariables.get(child.property)!
      const match = value.match(/^([0-9]+(?:\.[0-9]+)?)px$/)
      const number = match ? Number(match[1]) : Number.NaN
      isValid = number >= bounds[0] && number <= bounds[1]
    } else if (child.property === '--ambient-editor-font-weight') {
      const number = Number(value)
      isValid = Number.isInteger(number) && number >= 100 && number <= 900
    } else if (child.property === '--ambient-editor-line-height') {
      const number = Number(value)
      isValid = Number.isFinite(number) && number >= 1 && number <= 2.5
    } else if (child.property === '--ambient-editor-font-family') {
      isValid = value.length <= 160
        && lexer.matchProperty('font-family', value).error === null
        && !value.includes('var(')
    }

    if (!isValid) {
      addDiagnostic(
        diagnostics,
        'stylesheet.editor-variable-value',
        `Invalid value for ${child.property}.`,
        '/stylesheet',
      )
    }
  }
}

const validateStylesheet = (
  stylesheet: string,
  customizations: readonly AmbientCustomizationSlot[],
  diagnostics: AmbientDiagnostic[],
) => {
  let ast: CssNode
  try {
    ast = parseCss(stylesheet, { positions: true, parseCustomProperty: true })
  } catch (error) {
    addDiagnostic(
      diagnostics,
      'stylesheet.parse',
      error instanceof Error ? error.message : 'Invalid CSS.',
      '/stylesheet',
    )
    return
  }

  const usedCustomizationVariables = new Set<string>()
  const customizationByVariable = new Map<string, AmbientCustomizationSlot>(
    customizations.map((customization) => [customization.cssVariable, customization]),
  )

  walk(ast, {
    enter(node: CssNode) {
      if (node.type === 'Url') {
        const raster = validateRasterDataUrl(node.value)
        if (!raster.allowed) {
          addDiagnostic(diagnostics, 'stylesheet.external-resource', raster.message, '/stylesheet')
        }
      }
      if (node.type === 'ClassSelector' && node.name.startsWith('cm-')) {
        addDiagnostic(diagnostics, 'stylesheet.editor-selector', 'CodeMirror selectors are not allowed.', '/stylesheet')
      }
      if (node.type === 'Function') {
        const functionName = node.name.toLowerCase()
        if (externalResourceFunctions.has(functionName)) {
          addDiagnostic(diagnostics, 'stylesheet.external-resource', 'External resource functions are not allowed.', '/stylesheet')
        }
        if (functionName === 'var') {
          const variable = generate(node).match(/^var\((--ambient-[a-z0-9-]+)/)?.[1]
          if (variable && customizationByVariable.has(variable)) usedCustomizationVariables.add(variable)
        }
      }
      if (node.type === 'Atrule' && ['font-face', 'import', 'keyframes'].includes(node.name.toLowerCase())) {
        addDiagnostic(diagnostics, 'stylesheet.atrule-not-allowed', `@${node.name} is not allowed.`, '/stylesheet')
      }
      if (node.type === 'Rule') {
        const rule = node as Rule
        const selector = generate(rule.prelude)
        if (selector.includes('::slotted')) {
          validateSlottedRule(rule, diagnostics)
        } else if ([...rule.block.children].some((child) =>
          child.type === 'Declaration' && child.property.startsWith('--ambient-editor-'),
        )) {
          addDiagnostic(
            diagnostics,
            'stylesheet.editor-variable-location',
            'Editor variables may be set only on the documented code slot.',
            '/stylesheet',
          )
        }
      }
      if (node.type !== 'Declaration') return

      const declaration = node as Declaration
      const value = generate(declaration.value).toLowerCase()
      if (declaration.important) {
        addDiagnostic(diagnostics, 'stylesheet.important-not-allowed', '!important is not allowed.', '/stylesheet')
      }
      if (declaration.property.startsWith('animation') || declaration.property.startsWith('transition')) {
        addDiagnostic(diagnostics, 'stylesheet.declaration-not-allowed', `Declaration is not allowed: ${declaration.property}.`, '/stylesheet')
      }
      if (declaration.property === 'position' && !['absolute', 'relative', 'static'].includes(value)) {
        addDiagnostic(diagnostics, 'stylesheet.declaration-not-allowed', 'Only static, relative, and absolute positioning are allowed.', '/stylesheet')
      }

      for (const [variable, customization] of customizationByVariable) {
        if (!value.includes(`var(${variable}`)) continue

        const compatibleProperties = customization.type === 'palette' && customization.valueKind === 'paint'
          ? ['background', 'background-image']
          : ['background', 'background-color', 'border', 'border-bottom', 'border-color', 'border-left', 'border-right', 'border-top', 'box-shadow', 'color', 'fill', 'outline', 'outline-color', 'stroke', 'text-decoration-color']
        if (!compatibleProperties.includes(declaration.property)) {
          addDiagnostic(
            diagnostics,
            'stylesheet.customization-property',
            `${variable} is not compatible with ${declaration.property}.`,
            '/stylesheet',
          )
        }
      }
    },
  })

  const usedEditorVariables = stylesheet.match(editorVariablePattern) ?? []
  for (const variable of usedEditorVariables) {
    if (!allowedEditorVariables.has(variable)) {
      addDiagnostic(diagnostics, 'stylesheet.editor-variable', `Unknown editor variable: ${variable}.`, '/stylesheet')
    }
  }

  for (const customization of customizations) {
    if (!usedCustomizationVariables.has(customization.cssVariable)) {
      addDiagnostic(
        diagnostics,
        'stylesheet.customization-unused',
        `Customization variable is not used: ${customization.cssVariable}.`,
        '/stylesheet',
      )
    }
  }
}

export const compileAmbientDocument = (value: unknown) => {
  const diagnostics: AmbientDiagnostic[] = []
  if (!validateDocument(value, diagnostics)) {
    return { diagnostics, compiled: null }
  }

  const compiledTemplate = compileTemplate(value.template, diagnostics)
  const thumbnailResult = compileAmbientThumbnail(value.thumbnail)
  diagnostics.push(...thumbnailResult.diagnostics)
  validateStylesheet(value.stylesheet, value.customizations, diagnostics)

  return {
    diagnostics,
    compiled: diagnostics.length === 0
      ? {
          document: value,
          template: compiledTemplate.template,
          bindings: compiledTemplate.bindings,
          thumbnail: {
            template: thumbnailResult.compiled!.template,
            stylesheet: thumbnailResult.compiled!.stylesheet,
          },
        } satisfies CompiledAmbientDocument
      : null,
  }
}

export const assertCompiledAmbientDocument = (value: unknown) => {
  const result = compileAmbientDocument(value)
  if (result.compiled) return result.compiled

  const details = result.diagnostics
    .map((diagnostic) => `${diagnostic.code}${diagnostic.path ? ` (${diagnostic.path})` : ''}: ${diagnostic.message}`)
    .join('\n')
  throw new Error(`Invalid bundled ambient document:\n${details}`)
}
