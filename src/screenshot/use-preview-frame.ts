import {
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { readPreviewComposition, updatePreviewComposition } from './preview-composition-storage'

type PreviewMode = 'fit' | 'edit'

const minFrameWidth = 420
const maxFrameWidth = 1280
const defaultFrameWidth = 860
const frameWidthKeyStep = 20
const minEditablePreviewScale = 0.65

const clampFrameWidth = (width: number) =>
  Math.min(maxFrameWidth, Math.max(minFrameWidth, Math.round(width)))

type ResizeHandleProps = Pick<
  HTMLAttributes<HTMLDivElement>,
  | 'aria-valuemin'
  | 'aria-valuemax'
  | 'aria-valuenow'
  | 'onPointerDown'
  | 'onPointerMove'
  | 'onPointerUp'
  | 'onPointerCancel'
  | 'onDoubleClick'
  | 'onKeyDown'
>

export function usePreviewFrame() {
  const shotRef = useRef<HTMLDivElement>(null)
  const previewViewportRef = useRef<HTMLDivElement>(null)
  const widthDragRef = useRef<{ startX: number; startWidth: number; scale: number } | null>(null)
  const [frameWidth, setFrameWidth] = useState(
    () => clampFrameWidth(readPreviewComposition()?.frameWidth ?? defaultFrameWidth),
  )
  const [previewScale, setPreviewScale] = useState(1)
  const [previewMode, setPreviewMode] = useState<PreviewMode>('fit')
  const renderedPreviewScale = previewMode === 'edit'
    ? Math.max(previewScale, minEditablePreviewScale)
    : previewScale

  useEffect(() => {
    updatePreviewComposition({ frameWidth })
  }, [frameWidth])

  useEffect(() => {
    const viewport = previewViewportRef.current
    const frame = shotRef.current
    if (!viewport || !frame) return

    const updateScale = () => {
      const availableWidth = viewport.clientWidth - 40
      setPreviewScale(Math.min(1, availableWidth / frame.offsetWidth))
    }

    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(viewport)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const compactViewport = window.matchMedia('(max-width: 720px)')
    const resetDesktopMode = () => {
      if (!compactViewport.matches) setPreviewMode('fit')
    }

    compactViewport.addEventListener('change', resetDesktopMode)
    return () => compactViewport.removeEventListener('change', resetDesktopMode)
  }, [])

  useEffect(() => {
    if (previewMode === 'fit' && previewViewportRef.current) {
      previewViewportRef.current.scrollLeft = 0
    }
  }, [previewMode])

  const startWidthDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    widthDragRef.current = {
      startX: event.clientX,
      startWidth: frameWidth,
      scale: renderedPreviewScale,
    }
  }

  const moveWidthDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = widthDragRef.current
    if (!drag) return

    const widthDelta = ((event.clientX - drag.startX) * 2) / drag.scale
    setFrameWidth(clampFrameWidth(drag.startWidth + widthDelta))
  }

  const endWidthDrag = () => {
    widthDragRef.current = null
  }

  const nudgeFrameWidth = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

    event.preventDefault()
    const step = event.key === 'ArrowRight' ? frameWidthKeyStep : -frameWidthKeyStep
    setFrameWidth((previousWidth) => clampFrameWidth(previousWidth + step))
  }

  const resizeHandleProps: ResizeHandleProps = {
    'aria-valuemin': minFrameWidth,
    'aria-valuemax': maxFrameWidth,
    'aria-valuenow': frameWidth,
    onPointerDown: startWidthDrag,
    onPointerMove: moveWidthDrag,
    onPointerUp: endWidthDrag,
    onPointerCancel: endWidthDrag,
    onDoubleClick: () => setFrameWidth(defaultFrameWidth),
    onKeyDown: nudgeFrameWidth,
  }

  return {
    frameWidth,
    previewMode,
    renderedPreviewScale,
    shotRef,
    previewViewportRef,
    resizeHandleProps,
    showFittedPreview: () => setPreviewMode('fit'),
    showEditablePreview: () => setPreviewMode('edit'),
  }
}
