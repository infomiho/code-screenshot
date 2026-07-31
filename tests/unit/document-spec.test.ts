import { describe, expect, it } from 'vitest'
import { compileAmbientDocument } from '../../src/ambient/compiler'
import { ambientDocumentSpec } from '../../src/ambient/document-spec'
import { createMinimalDraftDocument } from '../../src/ambient/management/minimal-draft'
import { swissPosterDocument } from '../../src/ambient/rendering/themes/swiss-poster'
import { renderApiDoc, renderSchemaDoc } from '@infomiho/agent-work-protocol/server'
import type { AmbientDocument } from '../../src/ambient/schema'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

// Exercises the AmbientColorSlot branch of the schema, which no
// built-in theme uses.
const colorSlotDocument = (): AmbientDocument => {
  const document = clone(swissPosterDocument) as AmbientDocument
  const palette = document.customizations[0]
  if (palette.type !== 'palette') throw new Error('expected a palette slot')
  return {
    ...document,
    customizations: [{
      type: 'color',
      id: palette.id,
      label: palette.label,
      cssVariable: palette.cssVariable,
      defaultValue: palette.options[0].value,
    }],
  }
}

// Exercises the valueKind 'paint' branch. Paint palettes are only allowed in
// background properties, so the fixture drops the ground variable's border
// usage and keeps only its background usage.
const paintPaletteDocument = (): AmbientDocument => {
  const document = clone(swissPosterDocument) as AmbientDocument
  const palette = document.customizations[0]
  if (palette.type !== 'palette') throw new Error('expected a palette slot')
  return {
    ...document,
    stylesheet: document.stylesheet.replace(
      'var(--poster-signal-height) solid var(--ambient-poster-ground)',
      'var(--poster-signal-height) solid oklch(0.58 0.22 28)',
    ),
    customizations: [{
      ...palette,
      valueKind: 'paint',
      options: palette.options.map((option) => ({
        ...option,
        value: `linear-gradient(180deg, ${option.value}, ${option.value})`,
      })),
    }],
  }
}

const structuralIssues = async (document: unknown) => {
  const result = await ambientDocumentSpec.schema['~standard'].validate(document)
  return 'issues' in result ? result.issues : undefined
}

describe('schema accepts what the compiler accepts', () => {
  const corpus: [string, () => unknown][] = [
    ['swiss poster', () => clone(swissPosterDocument)],
    ['minimal draft', () => createMinimalDraftDocument('Schema check')],
    ['color slot fixture', colorSlotDocument],
    ['paint palette fixture', paintPaletteDocument],
  ]

  it.each(corpus)('%s', async (_name, build) => {
    const document = build()
    expect(compileAmbientDocument(document).compiled, 'fixture must be compiler-valid').not.toBeNull()
    expect(await structuralIssues(document)).toBeUndefined()
  })
})

describe('rejections carry documented diagnostic codes', () => {
  const docsDeps = { spec: ambientDocumentSpec, serverUrl: 'http://api.test' }
  const renderedDocs = renderApiDoc(docsDeps) + renderSchemaDoc(docsDeps)

  const rejectedDocuments: [string, () => unknown][] = [
    ['missing field', () => {
      const { thumbnail: _thumbnail, ...rest } = clone(swissPosterDocument) as AmbientDocument
      return rest
    }],
    ['wrong field type', () => ({ ...clone(swissPosterDocument) as AmbientDocument, name: 7 })],
    ['disallowed template element', () => ({
      ...clone(swissPosterDocument) as AmbientDocument,
      template: '<main><ambient-slot name="code"></ambient-slot></main>',
    })],
    ['disallowed stylesheet at-rule', () => {
      const document = clone(swissPosterDocument) as AmbientDocument
      return { ...document, stylesheet: `@import url('x.css');${document.stylesheet}` }
    }],
    ['unused customization variable', () => {
      const document = clone(swissPosterDocument) as AmbientDocument
      const palette = document.customizations[0]
      if (palette.type !== 'palette') throw new Error('expected a palette slot')
      return { ...document, customizations: [{ ...palette, cssVariable: '--ambient-never-used' }] }
    }],
  ]

  it.each(rejectedDocuments)('%s', async (_name, build) => {
    const result = await ambientDocumentSpec.validate(build())

    expect(result.document).toBeNull()
    expect(result.diagnostics.length).toBeGreaterThan(0)
    for (const diagnostic of result.diagnostics) {
      const family = diagnostic.code.split('.')[0]
      expect(
        ambientDocumentSpec.rules.some((rule) => rule.code === family),
        `code ${diagnostic.code} has no documented rule family`,
      ).toBe(true)
      expect(renderedDocs).toContain(`\`${family}\``)
    }
  })

  it('reports unknown keys structurally before the compiler runs', async () => {
    const document = { ...clone(swissPosterDocument) as AmbientDocument, extra: true }

    const issues = await structuralIssues(document)

    expect(issues).toBeDefined()
    expect(issues!.length).toBeGreaterThan(0)
  })
})

describe('published schema derivation', () => {
  it('jsonSchema is derived from the zod schema and stays an object schema', () => {
    expect(ambientDocumentSpec.jsonSchema).toMatchObject({ type: 'object' })
    expect(ambientDocumentSpec.jsonSchema.required).toEqual(expect.arrayContaining([
      'schemaVersion', 'name', 'editor', 'annotations', 'customizations', 'template', 'stylesheet', 'thumbnail',
    ]))
  })
})
