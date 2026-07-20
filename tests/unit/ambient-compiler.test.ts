import { describe, expect, it } from 'vitest'
import { compileAmbientDocument } from '../../src/ambient-compiler'
import type { AmbientDocument } from '../../src/ambient-schema'
import { compiledSwissPoster, swissPosterDocument } from '../../src/swiss-poster'

const validDocument: AmbientDocument = {
  schemaVersion: 1,
  name: 'Test ambient',
  editor: {
    exportGutter: 'show',
    tokens: {
      text: '#f8fafc',
      comment: '#94a3b8',
      string: '#86efac',
      keyword: '#22d3ee',
      number: '#fbbf24',
      function: '#f8fafc',
      type: '#c4b5fd',
      punctuation: '#cbd5e1',
    },
  },
  annotations: { ink: '#facc15' },
  customizations: [{
    type: 'palette',
    id: 'ground',
    label: 'Ground',
    cssVariable: '--ambient-ground',
    valueKind: 'paint',
    defaultOptionId: 'dark',
    options: [
      { id: 'dark', label: 'Dark', value: '#111827' },
      { id: 'gradient', label: 'Gradient', value: 'linear-gradient(135deg, #111827, #334155)' },
    ],
  }],
  template: `
    <article class="shell">
      <h2><ambient-slot name="title" fallback="Untitled" tooltip></ambient-slot></h2>
      <div class="code"><ambient-slot name="code"></ambient-slot></div>
      <footer>
        <ambient-slot name="lineCount" format="pad-3"></ambient-slot>
        <ambient-slot name="lineCount"></ambient-slot>
      </footer>
    </article>
  `,
  stylesheet: `
    :host { display: block; background: var(--ambient-ground); }
    ::slotted([slot='code']) {
      --ambient-editor-font-size: 15px;
      --ambient-editor-text-color: #f8fafc;
    }
  `,
  thumbnail: {
    template: '<div class="frame"><span class="line"></span></div>',
    stylesheet: ':host { display: block; } .frame { height: 100%; } .line { display: block; }',
  },
}

const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

describe('compileAmbientDocument', () => {
  it('compiles the bundled Swiss Poster document', () => {
    const result = compileAmbientDocument(swissPosterDocument)

    expect(result.diagnostics).toEqual([])
    expect(result.compiled).toEqual(compiledSwissPoster)
  })

  it('compiles safe text bindings and one native code slot', () => {
    const result = compileAmbientDocument(validDocument)

    expect(result.diagnostics).toEqual([])
    expect(result.compiled?.template).toContain('<slot name="code"></slot>')
    expect(result.compiled?.template).not.toContain('ambient-slot')
    expect(result.compiled?.bindings).toEqual([
      { id: 0, source: 'title', format: 'plain', fallback: 'Untitled', tooltip: true },
      { id: 1, source: 'lineCount', format: 'pad-3', fallback: undefined, tooltip: false },
      { id: 2, source: 'lineCount', format: 'plain', fallback: undefined, tooltip: false },
    ])
  })

  it('rejects dynamic or externally styled thumbnails', () => {
    const result = compileAmbientDocument({
      ...validDocument,
      thumbnail: {
        template: '<div><ambient-slot name="title"></ambient-slot></div>',
        stylesheet: '.frame { background: url("https://example.com/image.png"); transition: opacity 1s; }',
      },
    })

    expect(result.compiled).toBeNull()
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining([
      'thumbnail.element-not-allowed',
      'thumbnail.attribute-not-allowed',
      'thumbnail.external-resource',
      'thumbnail.declaration-not-allowed',
    ]))
  })

  it('contains thumbnail selectors and declarations', () => {
    const result = compileAmbientDocument({
      ...validDocument,
      thumbnail: {
        template: '<div class="frame"></div>',
        stylesheet: `
          :host { display: block; }
          .frame { --position: fixed; position: var(--position); all: initial; }
          :\\68 ost { color: red; }
        `,
      },
    })

    expect(result.compiled).toBeNull()
    expect(result.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      'thumbnail.declaration-not-allowed',
      'thumbnail.selector-not-allowed',
    ]))
  })

  it('scopes thumbnail hosts and counts only elements', () => {
    const children = Array.from({ length: 23 }, (_, index) =>
      `\n  <span class="line-${index}"></span>`,
    ).join('')
    const result = compileAmbientDocument({
      ...validDocument,
      thumbnail: {
        template: `<div class="frame">${children}\n</div>`,
        stylesheet: ':host { display: block; }',
      },
    })

    expect(result.diagnostics).toEqual([])
    expect(result.compiled?.thumbnail.stylesheet).toContain('[data-codeshot-thumbnail-canvas]')
    expect(result.compiled?.thumbnail.stylesheet).not.toContain(':host')
  })

  it('rejects missing and duplicate code slots', () => {
    const missing = compileAmbientDocument({ ...validDocument, template: '<article></article>' })
    const duplicate = compileAmbientDocument({
      ...validDocument,
      template: '<article><ambient-slot name="code"></ambient-slot><ambient-slot name="code"></ambient-slot></article>',
    })

    expect(missing.diagnostics.map(({ code }) => code)).toContain('template.code-slot-count')
    expect(duplicate.diagnostics.map(({ code }) => code)).toContain('template.code-slot-count')
  })

  it('rejects executable HTML and CodeMirror selectors', () => {
    const result = compileAmbientDocument({
      ...validDocument,
      template: '<article><script>alert(1)</script><ambient-slot name="code"></ambient-slot></article>',
      stylesheet: '.cm-editor { color: red; }',
    })

    expect(result.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      'template.element-not-allowed',
      'stylesheet.editor-selector',
      'stylesheet.customization-unused',
    ]))
  })

  it('rejects important declarations', () => {
    const result = compileAmbientDocument({
      ...validDocument,
      stylesheet: ':host { background: var(--ambient-ground) !important; }',
    })

    expect(result.diagnostics.map(({ code }) => code)).toContain('stylesheet.important-not-allowed')
  })

  it('rejects transition longhands and indirect fixed positioning', () => {
    const result = compileAmbientDocument({
      ...validDocument,
      stylesheet: `
        :host {
          --layout: fixed;
          background: var(--ambient-ground);
          position: var(--layout);
          transition-duration: 10s;
        }
      `,
    })

    expect(result.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      'stylesheet.declaration-not-allowed',
    ]))
  })

  it('bounds documented editor variables', () => {
    const result = compileAmbientDocument({
      ...validDocument,
      stylesheet: `
        :host { background: var(--ambient-ground); }
        ::slotted([slot='code']) { --ambient-editor-font-size: 1000000px; }
      `,
    })

    expect(result.diagnostics.map(({ code }) => code)).toContain('stylesheet.editor-variable-value')
  })

  it('allows editor variables only on the code slot', () => {
    const result = compileAmbientDocument({
      ...validDocument,
      stylesheet: `
        :host {
          background: var(--ambient-ground);
          --ambient-editor-font-size: 15px;
        }
      `,
    })

    expect(result.diagnostics.map(({ code }) => code)).toContain('stylesheet.editor-variable-location')
  })

  it('requires a real compatible customization reference', () => {
    const commentOnly = compileAmbientDocument({
      ...validDocument,
      stylesheet: ':host { background: black; /* var(--ambient-ground) */ }',
    })
    const incompatible = compileAmbientDocument({
      ...validDocument,
      stylesheet: ':host { width: var(--ambient-ground); }',
    })

    expect(commentOnly.diagnostics.map(({ code }) => code)).toContain('stylesheet.customization-unused')
    expect(incompatible.diagnostics.map(({ code }) => code)).toContain('stylesheet.customization-property')
  })

  it('rejects URL-bearing image functions', () => {
    const result = compileAmbientDocument({
      ...validDocument,
      stylesheet: ':host { background: var(--ambient-ground), image-set("https://example.com/image.png" 1x); }',
    })

    expect(result.diagnostics.map(({ code }) => code)).toContain('stylesheet.external-resource')
  })

  it('allows bounded base64 raster images but rejects SVG data URLs', () => {
    const raster = compileAmbientDocument({
      ...validDocument,
      stylesheet: `:host { background: var(--ambient-ground); background-image: url("${onePixelPng}"); }`,
      thumbnail: {
        ...validDocument.thumbnail,
        stylesheet: `:host { background-image: url("${onePixelPng}"); }`,
      },
    })
    const svg = compileAmbientDocument({
      ...validDocument,
      stylesheet: ':host { background: var(--ambient-ground); background-image: url("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="); }',
    })

    expect(raster.diagnostics).toEqual([])
    expect(svg.diagnostics.map(({ code }) => code)).toContain('stylesheet.external-resource')
  })

  it('rejects truncated raster images', () => {
    const encoded = onePixelPng.split(',')[1]
    const truncated = Buffer.from(encoded, 'base64').subarray(0, -8).toString('base64')
    const result = compileAmbientDocument({
      ...validDocument,
      stylesheet: `:host { background: var(--ambient-ground); background-image: url("data:image/png;base64,${truncated}"); }`,
    })

    expect(result.diagnostics.map(({ code }) => code)).toContain('stylesheet.external-resource')
  })

  it('limits the complete ambient document size', () => {
    const oversizedDocument = {
      ...validDocument,
      template: `<article>${'x'.repeat(192 * 1024)}<ambient-slot name="code"></ambient-slot></article>`,
    }
    const result = compileAmbientDocument(oversizedDocument)
    const currentBytes = new TextEncoder().encode(JSON.stringify(oversizedDocument)).byteLength

    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'document.size-limit',
      message: `Document is ${currentBytes} bytes; maximum is 196608 bytes.`,
    }))
  })

  it('measures field limits as UTF-8 bytes', () => {
    const stylesheet = `/*${'é'.repeat(49_152)}*/`
    const result = compileAmbientDocument({ ...validDocument, stylesheet })

    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'stylesheet.limit-exceeded',
      message: 'Stylesheet is 98308 bytes; maximum is 98304 bytes.',
    }))
  })

  it('reports decoded raster byte limits exactly', () => {
    const oversizedRaster = Buffer.alloc(48 * 1024 + 1).toString('base64')
    const result = compileAmbientDocument({
      ...validDocument,
      stylesheet: `:host { background: var(--ambient-ground); background-image: url("data:image/png;base64,${oversizedRaster}"); }`,
    })

    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'stylesheet.external-resource',
      message: 'Decoded raster is 49153 bytes; maximum is 49152 bytes.',
    }))
  })

  it('rejects external resources in paint values and stylesheets', () => {
    const invalidPaint = compileAmbientDocument({
      ...validDocument,
      customizations: [{
        ...validDocument.customizations[0],
        options: [{ id: 'remote', label: 'Remote', value: 'url(https://example.com/image.png)' }],
        defaultOptionId: 'remote',
      }],
    })
    const externalStylesheet = compileAmbientDocument({
      ...validDocument,
      stylesheet: ':host { background: var(--ambient-ground), url(https://example.com/image.png); }',
    })

    expect(invalidPaint.diagnostics.map(({ code }) => code)).toContain('value.invalid')
    expect(externalStylesheet.diagnostics.map(({ code }) => code)).toContain('stylesheet.external-resource')
  })

  it('rejects unknown fields with stable diagnostic paths', () => {
    const result = compileAmbientDocument({ ...validDocument, executable: true })

    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'document.unknown-field',
      path: '/executable',
    }))
  })
})
