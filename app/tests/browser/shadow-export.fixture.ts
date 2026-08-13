import { javascript } from '@codemirror/lang-javascript'
import { EditorState, StateField } from '@codemirror/state'
import { Decoration, EditorView, lineNumbers, type DecorationSet } from '@codemirror/view'
import { domToBlob } from 'modern-screenshot'

const colors = {
  annotation: [250, 204, 21],
  ground: [190, 18, 60],
  gutter: [168, 85, 247],
  highlight: [20, 83, 45],
  keyword: [34, 211, 238],
} as const

const fixtureStyles = document.createElement('style')
fixtureStyles.textContent = `
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; background: #f8fafc; }
  body { padding: 20px; }
  .capture { position: relative; container: fixture / inline-size; }
  .capture.exporting[data-export-gutter='hide'] .cm-gutters { visibility: hidden; }
  .code-editor-host .cm-editor {
    min-height: 140px;
    background: var(--fixture-editor-background, #111827);
    color: var(--fixture-editor-text, #f8fafc);
    font-size: var(--fixture-editor-size, 20px);
    line-height: 1.6;
  }
  .code-editor-host .cm-scroller { overflow: visible; font-family: ui-monospace, monospace; }
  .code-editor-host .cm-content { padding: 16px; caret-color: transparent; }
  .code-editor-host .cm-gutters {
    border: 0;
    background: var(--fixture-editor-background, #111827);
    color: var(--fixture-gutter, #a855f7);
    padding: 16px 8px;
  }
  .code-editor-host .cm-line.fixture-highlight { background: #14532d; }
  .code-editor-host .fixture-keyword { color: #22d3ee; font-weight: 700; }
  .annotation {
    position: absolute;
    right: 18px;
    bottom: 18px;
    width: 42px;
    height: 10px;
    border-radius: 999px;
    background: #facc15;
    rotate: -8deg;
  }
`
document.head.append(fixtureStyles)

const root = document.querySelector<HTMLElement>('#fixture-root')
if (!root) throw new Error('Missing fixture root')

const capture = document.createElement('section')
capture.className = 'capture'
capture.dataset.exportGutter = 'show'

const ambientHost = document.createElement('div')
ambientHost.style.setProperty('--ambient-ground', '#be123c')

const editorHost = document.createElement('div')
editorHost.className = 'code-editor-host'
editorHost.slot = 'code'
ambientHost.append(editorHost)

const shadowRoot = ambientHost.attachShadow({ mode: 'open' })
shadowRoot.innerHTML = `
  <style>
    :host {
      display: block;
      padding: 24px;
      background: var(--ambient-ground);
    }
    .shell { overflow: hidden; border: 2px solid #0f172a; background: #111827; }
    .header { padding: 12px 16px; background: #0f172a; color: #f8fafc; font: 700 16px system-ui; }
    ::slotted([slot='code']) {
      --fixture-editor-background: #111827;
      --fixture-editor-text: #f8fafc;
      --fixture-editor-size: 20px;
      --fixture-gutter: #a855f7;
    }
    @container fixture (max-width: 600px) {
      .header { background: #1d4ed8; }
      ::slotted([slot='code']) { --fixture-editor-size: 16px; }
    }
  </style>
  <article class="shell">
    <header class="header">Open shadow root</header>
    <slot name="code"></slot>
  </article>
`

const annotation = document.createElement('div')
annotation.className = 'annotation'
capture.append(ambientHost, annotation)
root.append(capture)

const highlightedLine = Decoration.line({ attributes: { class: 'fixture-highlight' } })
const keywordMark = Decoration.mark({ class: 'fixture-keyword' })
const highlightField = StateField.define<DecorationSet>({
  create(state) {
    return Decoration.set([
      keywordMark.range(0, 5),
      highlightedLine.range(state.doc.line(2).from),
    ], true)
  },
  update(value, transaction) {
    return value.map(transaction.changes)
  },
  provide: (field) => EditorView.decorations.from(field),
})

new EditorView({
  parent: editorHost,
  state: EditorState.create({
    doc: 'const shadow = "open"\nfunction captureAmbient() {\n  return shadow\n}',
    extensions: [
      lineNumbers(),
      javascript(),
      highlightField,
      EditorView.editable.of(false),
    ],
  }),
})

const countPixelsNear = (
  pixels: Uint8ClampedArray,
  [red, green, blue]: readonly number[],
) => {
  let count = 0

  for (let index = 0; index < pixels.length; index += 4) {
    if (
      Math.abs(pixels[index] - red) <= 3
      && Math.abs(pixels[index + 1] - green) <= 3
      && Math.abs(pixels[index + 2] - blue) <= 3
      && pixels[index + 3] > 0
    ) {
      count += 1
    }
  }

  return count
}

async function exportFixture(width: number, exportGutter: 'show' | 'hide') {
  capture.style.width = `${width}px`
  capture.dataset.exportGutter = exportGutter
  capture.classList.add('exporting')
  await document.fonts.ready
  await new Promise(requestAnimationFrame)

  try {
    const blob = await domToBlob(capture, {
      backgroundColor: null,
      scale: 2,
      width: capture.offsetWidth,
      height: capture.offsetHeight,
    })
    if (!blob) throw new Error('Exporter returned no blob')

    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Missing canvas context')

    context.drawImage(bitmap, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data

    return {
      blobSize: blob.size,
      dimensions: { width: bitmap.width, height: bitmap.height },
      gutterVisibility: getComputedStyle(editorHost.querySelector('.cm-gutters')!).visibility,
      liveTextStyles: [...editorHost.querySelectorAll<HTMLElement>('.cm-line span')]
        .map((element) => ({
          className: element.className,
          color: getComputedStyle(element).color,
          text: element.textContent,
        })),
      mimeType: blob.type,
      pixels: Object.fromEntries(
        Object.entries(colors).map(([name, color]) => [name, countPixelsNear(pixels, color)]),
      ),
    }
  } finally {
    capture.classList.remove('exporting')
  }
}

declare global {
  interface Window {
    exportShadowFixture: typeof exportFixture
  }
}

window.exportShadowFixture = exportFixture
