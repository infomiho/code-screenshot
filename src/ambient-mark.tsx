import { useLayoutEffect, useRef } from 'react'
import type { AmbientDefinition } from './ambient-themes'

function DeclarativeAmbientMark({ definition }: { definition: AmbientDefinition & { kind: 'declarative' } }) {
  const markRef = useRef<HTMLSpanElement>(null)
  const thumbnail = definition.compiledDocument.thumbnail

  useLayoutEffect(() => {
    const host = markRef.current
    if (!host) return

    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    const canvasSelector = '[data-codeshot-thumbnail-canvas]'
    style.textContent = `
      :host {
        display: block !important;
      }
      :host, ${canvasSelector} {
        width: 100% !important;
        height: 100% !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        pointer-events: none !important;
        contain: layout paint style !important;
      }
      ${thumbnail.stylesheet}
      ${canvasSelector} {
        position: relative !important;
      }
    `
    const template = document.createElement('template')
    template.innerHTML = thumbnail.template
    const canvas = document.createElement('div')
    canvas.dataset.codeshotThumbnailCanvas = ''
    canvas.append(template.content.cloneNode(true))
    root.replaceChildren(style, canvas)
  }, [thumbnail])

  return <span ref={markRef} className="ambient-mark ambient-mark--declarative" aria-hidden="true" />
}

export function AmbientMark({ definition }: { definition: AmbientDefinition }) {
  if (definition.kind === 'declarative') {
    return <DeclarativeAmbientMark definition={definition} />
  }

  const markerClass = definition.source === 'built-in'
    ? `ambient-mark--${definition.id}`
    : 'ambient-mark--user'

  return <span className={`ambient-mark ${markerClass}`} aria-hidden="true" />
}
