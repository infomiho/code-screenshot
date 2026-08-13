import {
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react'
import type {
  AmbientTextBinding,
  CompiledAmbientDocument,
  ScreenshotContent,
} from '../schema'

type DeclarativeAmbientProps = {
  compiledDocument: CompiledAmbientDocument
  content: ScreenshotContent
  style: CSSProperties
  children: ReactNode
}

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

const getBindingValue = (binding: AmbientTextBinding, content: ScreenshotContent) => {
  let value: string

  switch (binding.source) {
    case 'fileTypeId':
      value = content.fileType.id
      break
    case 'fileTypeLabel':
      value = content.fileType.label
      break
    case 'lineCount':
      value = String(content.lineCount)
      break
    case 'title':
      value = content.title
      break
  }

  if (value.length === 0 && binding.fallback !== undefined) value = binding.fallback
  return binding.format === 'pad-3' ? value.padStart(3, '0') : value
}

export function DeclarativeAmbient({
  compiledDocument,
  content,
  style,
  children,
}: DeclarativeAmbientProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useIsomorphicLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return

    const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
    const stylesheet = document.createElement('style')
    const template = document.createElement('template')
    stylesheet.textContent = compiledDocument.document.stylesheet
    template.innerHTML = compiledDocument.template
    shadowRoot.replaceChildren(stylesheet, template.content.cloneNode(true))
  }, [compiledDocument])

  useIsomorphicLayoutEffect(() => {
    const shadowRoot = hostRef.current?.shadowRoot
    if (!shadowRoot) return

    for (const binding of compiledDocument.bindings) {
      const element = shadowRoot.querySelector<HTMLElement>(
        `[data-ambient-binding="${binding.id}"]`,
      )
      if (!element) continue

      const value = getBindingValue(binding, content)
      element.textContent = value
      if (binding.tooltip) {
        element.title = value
      } else {
        element.removeAttribute('title')
      }
    }
  }, [compiledDocument, content])

  return (
    <div className="declarative-ambient" ref={hostRef} style={style}>
      {children}
    </div>
  )
}
