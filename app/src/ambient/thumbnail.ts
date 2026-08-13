import {
  generate,
  parse as parseCss,
  walk,
  type AttributeSelector,
  type CssNode,
} from 'css-tree'
import {
  parseFragment,
  serialize,
  type DefaultTreeAdapterTypes,
  type ParserError,
} from 'parse5'
import type { AmbientDiagnostic, AmbientThumbnail } from './schema'
import { validateRasterDataUrl } from './raster-data-url'

type HtmlNode = DefaultTreeAdapterTypes.ChildNode
type HtmlElement = DefaultTreeAdapterTypes.Element

const allowedElements = new Set(['div', 'i', 'span'])
const classListPattern = /^[a-z][a-z0-9-]*(?: [a-z][a-z0-9-]*)*$/
const externalResourceFunctions = new Set(['-webkit-image-set', 'cross-fade', 'element', 'image-set'])
const maxDepth = 6
const maxNodes = 24

const createCanvasSelector = (): AttributeSelector => ({
  type: 'AttributeSelector',
  name: { type: 'Identifier', name: 'data-codeshot-thumbnail-canvas' },
  matcher: null,
  value: null,
  flags: null,
})

const isElement = (node: HtmlNode): node is HtmlElement => 'tagName' in node

const addDiagnostic = (
  diagnostics: AmbientDiagnostic[],
  code: string,
  message: string,
  path: string,
) => diagnostics.push({ severity: 'error', code, message, path })

const compileTemplate = (template: string, diagnostics: AmbientDiagnostic[]) => {
  const parseErrors: ParserError[] = []
  const fragment = parseFragment(template, {
    onParseError: (error) => parseErrors.push(error),
  })
  for (const error of parseErrors) {
    addDiagnostic(
      diagnostics,
      'thumbnail.template-parse',
      `Invalid thumbnail HTML: ${error.code}.`,
      '/thumbnail/template',
    )
  }

  const roots = fragment.childNodes.filter((node) =>
    !('value' in node) || node.value.trim().length > 0,
  )
  if (roots.length !== 1 || !isElement(roots[0])) {
    addDiagnostic(
      diagnostics,
      'thumbnail.root-count',
      'Thumbnail template must contain one root element.',
      '/thumbnail/template',
    )
  }

  let nodeCount = 0
  const visit = (node: HtmlNode, depth: number) => {
    if (node.nodeName === '#comment' || node.nodeName === '#documentType') {
      addDiagnostic(
        diagnostics,
        'thumbnail.element-not-allowed',
        'Thumbnail comments and document types are not allowed.',
        '/thumbnail/template',
      )
      return
    }
    if ('value' in node) {
      if (node.value.trim().length > 0) {
        addDiagnostic(
          diagnostics,
          'thumbnail.text-not-allowed',
          'Thumbnail text is not allowed.',
          '/thumbnail/template',
        )
      }
      return
    }
    if (!isElement(node)) return
    nodeCount += 1
    if (nodeCount > maxNodes || depth > maxDepth) {
      addDiagnostic(
        diagnostics,
        'thumbnail.structure-limit',
        'Thumbnail structure is too complex.',
        '/thumbnail/template',
      )
      return
    }
    if (!allowedElements.has(node.tagName)) {
      addDiagnostic(
        diagnostics,
        'thumbnail.element-not-allowed',
        `Thumbnail element is not allowed: ${node.tagName}.`,
        '/thumbnail/template',
      )
    }
    for (const attribute of node.attrs) {
      if (attribute.name !== 'class' || !classListPattern.test(attribute.value)) {
        addDiagnostic(
          diagnostics,
          'thumbnail.attribute-not-allowed',
          `Thumbnail attribute is not allowed: ${attribute.name}.`,
          '/thumbnail/template',
        )
      }
    }
    for (const child of node.childNodes) visit(child, depth + 1)
  }

  for (const node of fragment.childNodes) visit(node, 1)
  return serialize(fragment)
}

const compileStylesheet = (stylesheet: string, diagnostics: AmbientDiagnostic[]) => {
  let ast: CssNode
  try {
    ast = parseCss(stylesheet, { positions: true, parseCustomProperty: true })
  } catch (error) {
    addDiagnostic(
      diagnostics,
      'thumbnail.stylesheet-parse',
      error instanceof Error ? error.message : 'Invalid thumbnail CSS.',
      '/thumbnail/stylesheet',
    )
    return stylesheet
  }

  walk(ast, (node, item) => {
    if (node.type === 'Url') {
      const raster = validateRasterDataUrl(node.value)
      if (!raster.allowed) {
        addDiagnostic(
          diagnostics,
          'thumbnail.external-resource',
          raster.message,
          '/thumbnail/stylesheet',
        )
      }
    }
    if (node.type === 'Function' && externalResourceFunctions.has(node.name.toLowerCase())) {
      addDiagnostic(
        diagnostics,
        'thumbnail.external-resource',
        'Thumbnail external resource functions are not allowed.',
        '/thumbnail/stylesheet',
      )
    }
    if (node.type === 'Atrule' && ['font-face', 'import', 'keyframes'].includes(node.name.toLowerCase())) {
      addDiagnostic(
        diagnostics,
        'thumbnail.atrule-not-allowed',
        `Thumbnail @${node.name} is not allowed.`,
        '/thumbnail/stylesheet',
      )
    }
    if (node.type === 'PseudoClassSelector') {
      if (node.name === 'host' && node.children === null) {
        item.data = createCanvasSelector()
      } else {
        addDiagnostic(
          diagnostics,
          'thumbnail.selector-not-allowed',
          `Thumbnail pseudo-class is not allowed: ${node.name}.`,
          '/thumbnail/stylesheet',
        )
      }
    }
    if (node.type === 'PseudoElementSelector') {
      addDiagnostic(
        diagnostics,
        'thumbnail.selector-not-allowed',
        'Thumbnail pseudo-elements are not allowed.',
        '/thumbnail/stylesheet',
      )
    }
    if (node.type !== 'Declaration') return

    const property = node.property.toLowerCase()
    const value = generate(node.value).toLowerCase()
    const isDisallowed = node.important
      || /^(?:-[a-z]+-)?(?:animation|transition)/.test(property)
      || property === 'all'
      || property === 'pointer-events'
      || (property === 'position' && !['absolute', 'relative', 'static'].includes(value))
    if (isDisallowed) {
      addDiagnostic(
        diagnostics,
        'thumbnail.declaration-not-allowed',
        `Thumbnail declaration is not allowed: ${property}.`,
        '/thumbnail/stylesheet',
      )
    }
  })

  return generate(ast)
}

export const compileAmbientThumbnail = (thumbnail: AmbientThumbnail) => {
  const diagnostics: AmbientDiagnostic[] = []
  const template = compileTemplate(thumbnail.template, diagnostics)
  const stylesheet = compileStylesheet(thumbnail.stylesheet, diagnostics)
  return {
    diagnostics,
    compiled: diagnostics.length === 0
      ? { template, stylesheet }
      : null,
  }
}
