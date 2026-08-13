import { domToBlob } from 'modern-screenshot'

const shouldExportNode = (node: Node) => {
  if (!(node instanceof HTMLElement)) return true

  const className = String(node.className)
  return !['cm-cursorLayer', 'cm-selectionLayer', 'cm-tooltip', 'cm-announced', 'width-handle'].some(
    (hiddenClass) => className.includes(hiddenClass),
  )
}

export async function renderScreenshotBlob(frame: HTMLElement) {
  frame.classList.add('shot-frame--exporting')

  try {
    await document.fonts.ready
    await new Promise(requestAnimationFrame)
    return await domToBlob(frame, {
      backgroundColor: null,
      scale: 2,
      width: frame.offsetWidth,
      height: frame.offsetHeight,
      filter: shouldExportNode,
    })
  } finally {
    frame.classList.remove('shot-frame--exporting')
  }
}
