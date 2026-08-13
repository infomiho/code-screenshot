import type { AmbientDocument } from '../ambient/schema'

export type RenderTheme =
  | { kind: 'built-in'; id: string; version: number }
  | { kind: 'declarative'; id: string; version: number; document: AmbientDocument }

export type ScreenshotRenderRequest = {
  code: string
  customizations: Record<string, string>
  highlightedLines: number[]
  language: string
  scale: 1 | 2
  theme: RenderTheme
  title: string
  width: number
}

declare global {
  interface Window {
    __CODESHOT_RENDER_REQUEST__?: ScreenshotRenderRequest
  }
}
