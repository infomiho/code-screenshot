import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '../../src/app'
import { loadAmbientDefinition } from '../../src/ambient-registry'
import { AgentPreviewCanvas } from '../../src/ambient-workspace/agent-preview-page'
import { MockAmbientService } from '../../src/ambient-workspace/mock-ambient-service'
import { renderScreenshotBlob } from '../../src/screenshot-export'
import { swissPosterDocument } from '../../src/swiss-poster'

const root = document.querySelector<HTMLElement>('#root')
if (!root) throw new Error('Missing app root')
const ambientWorkspaceService = new MockAmbientService({ agentUpdate: 0, save: 0 })
const previewResult = loadAmbientDefinition({
  id: 'agent-preview',
  version: 1,
  document: swissPosterDocument,
}, 'draft')
const isAgentPreview = new URLSearchParams(window.location.search).has('agent-preview')
const hasExistingDraft = new URLSearchParams(window.location.search).has('existing-draft')

if (hasExistingDraft) {
  ambientWorkspaceService.signIn()
  ambientWorkspaceService.beginAmbient()
  ambientWorkspaceService.createAmbient('Existing draft')
  ambientWorkspaceService.forgetAgentAccess()
}

if (!previewResult.definition || previewResult.definition.kind !== 'declarative') {
  throw new Error('Invalid agent preview fixture')
}

createRoot(root).render(
  <StrictMode>
    {isAgentPreview
      ? <AgentPreviewCanvas definition={previewResult.definition} />
      : <App ambientWorkspaceService={ambientWorkspaceService} />}
  </StrictMode>,
)

async function exportCurrentFrame(width: number) {
  const frame = document.querySelector<HTMLElement>('.shot-frame')
  if (!frame) throw new Error('Missing screenshot frame')

  frame.style.width = `${width}px`
  const blob = await renderScreenshotBlob(frame)
  if (!blob) throw new Error('Exporter returned no blob')

  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Missing canvas context')
  context.drawImage(bitmap, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data

  const resolveColor = (value: string) => {
    const colorCanvas = document.createElement('canvas')
    colorCanvas.width = 1
    colorCanvas.height = 1
    const colorContext = colorCanvas.getContext('2d')!
    colorContext.fillStyle = value
    colorContext.fillRect(0, 0, 1, 1)
    return colorContext.getImageData(0, 0, 1, 1).data
  }

  const countColor = (value?: string, background?: string) => {
    if (!value) return 0
    const [foregroundRed, foregroundGreen, foregroundBlue, foregroundAlpha] = resolveColor(value)
    const [backgroundRed, backgroundGreen, backgroundBlue] = background
      ? resolveColor(background)
      : [0, 0, 0]
    const alpha = foregroundAlpha / 255
    const red = Math.round(foregroundRed * alpha + backgroundRed * (1 - alpha))
    const green = Math.round(foregroundGreen * alpha + backgroundGreen * (1 - alpha))
    const blue = Math.round(foregroundBlue * alpha + backgroundBlue * (1 - alpha))
    let count = 0
    for (let index = 0; index < pixels.length; index += 4) {
      if (
        Math.abs(pixels[index] - red) <= 4
        && Math.abs(pixels[index + 1] - green) <= 4
        && Math.abs(pixels[index + 2] - blue) <= 4
        && pixels[index + 3] > 0
      ) count += 1
    }
    return count
  }

  const ambientHost = frame.querySelector<HTMLElement>('.declarative-ambient')
  const keyword = [...frame.querySelectorAll<HTMLElement>('.cm-line span')]
    .find((element) => element.textContent === 'import')
  const highlightedLine = frame.querySelector<HTMLElement>('.cm-highlighted-line')
  const paper = ambientHost?.shadowRoot?.querySelector<HTMLElement>('.shell')
  const liveColors = {
    ground: ambientHost ? getComputedStyle(ambientHost).backgroundColor : '',
    highlight: highlightedLine ? getComputedStyle(highlightedLine).backgroundColor : '',
    keyword: keyword ? getComputedStyle(keyword).color : '',
    paper: paper ? getComputedStyle(paper).backgroundColor : '',
  }

  return {
    blobSize: blob.size,
    height: bitmap.height,
    mimeType: blob.type,
    liveColors,
    pixels: {
      ground: countColor(liveColors.ground),
      highlight: countColor(liveColors.highlight, liveColors.paper),
      keyword: countColor(liveColors.keyword),
    },
    width: bitmap.width,
  }
}

declare global {
  interface Window {
    ambientWorkspaceService: MockAmbientService
    exportCurrentFrame: typeof exportCurrentFrame
  }
}

window.ambientWorkspaceService = ambientWorkspaceService
window.exportCurrentFrame = exportCurrentFrame
