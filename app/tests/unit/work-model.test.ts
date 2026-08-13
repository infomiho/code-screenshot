import { describe, expect, it } from 'vitest'
import { createModelDocs } from '@infomiho/agent-work-protocol/server'
import { compileAmbientDocument } from '../../src/ambient/compiler'
import { ambientWorkModel } from '../../src/ambient/work-model'
import { createMinimalDraftDocument } from '../../src/ambient/management/minimal-draft'
import { swissPosterDocument } from '../../src/ambient/rendering/themes/swiss-poster'
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
  const result = await ambientWorkModel.schema.decoder['~standard'].validate(document)
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

describe('assessment', () => {
  const renderedWorkDoc = createModelDocs({
    model: ambientWorkModel,
    serverUrl: 'http://api.test',
  }).handleDocsRequest({
    model: ambientWorkModel.id,
    version: ambientWorkModel.version,
    document: 'work.md',
  })

  const rejectedDocuments: [string, () => AmbientDocument][] = [
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
    const result = await ambientWorkModel.assess(build())

    expect(result.artifacts).toBeUndefined()
    expect(result.diagnostics.length).toBeGreaterThan(0)
    for (const diagnostic of result.diagnostics) {
      const family = diagnostic.code.split('.')[0]
      expect(
        ambientWorkModel.authoring.diagnostics.some((definition) => definition.code === family),
        `code ${diagnostic.code} has no documented family`,
      ).toBe(true)
      expect(renderedWorkDoc.content).toMatchObject({
        type: 'markdown',
        body: expect.stringContaining(`\`${family}\``),
      })
      expect(diagnostic.pointer).toMatch(/^\//)
    }
  })

  it('returns compiled output as host-side artifacts', async () => {
    const result = await ambientWorkModel.assess(clone(swissPosterDocument))

    expect(result.diagnostics).toEqual([])
    expect(result.artifacts).toEqual(compileAmbientDocument(swissPosterDocument).compiled)
  })

  it('reports unknown keys structurally before assessment', async () => {
    const document = { ...clone(swissPosterDocument) as AmbientDocument, extra: true }

    const issues = await structuralIssues(document)

    expect(issues).toBeDefined()
    expect(issues!.length).toBeGreaterThan(0)
  })
})

describe('published schema derivation', () => {
  it('derives an object schema from the decoder', () => {
    expect(ambientWorkModel.schema.jsonSchema).toMatchObject({ type: 'object' })
    expect(ambientWorkModel.schema.jsonSchema.required).toEqual(expect.arrayContaining([
      'schemaVersion', 'name', 'editor', 'annotations', 'customizations', 'template', 'stylesheet', 'thumbnail',
    ]))
  })
})
