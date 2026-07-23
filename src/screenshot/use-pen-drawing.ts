import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type SVGProps,
} from 'react'
import { getStroke } from 'perfect-freehand'
import {
  readPreviewComposition,
  updatePreviewComposition,
  type PenStroke,
} from './preview-composition-storage'

const penStrokeOptions = {
  size: 6,
  thinning: 0,
  smoothing: 0.55,
  streamline: 0.5,
  simulatePressure: false,
}

const average = (a: number, b: number) => (a + b) / 2

const getSvgPathFromStroke = (points: number[][]) => {
  const len = points.length
  if (len < 4) return ''

  let a = points[0]
  let b = points[1]
  const c = points[2]
  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(b[1], c[1]).toFixed(2)} T`

  for (let i = 2, max = len - 1; i < max; i += 1) {
    a = points[i]
    b = points[i + 1]
    result += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(2)} `
  }

  return `${result}Z`
}

const getPenStrokePath = (points: PenStroke) =>
  getSvgPathFromStroke(getStroke(points, penStrokeOptions))

const cornerTurnCosine = Math.cos((65 * Math.PI) / 180)

const findPenCorners = (points: PenStroke) => {
  const corners = new Set<number>()

  for (let i = 2; i < points.length - 2; i += 1) {
    const v1x = points[i][0] - points[i - 2][0]
    const v1y = points[i][1] - points[i - 2][1]
    const v2x = points[i + 2][0] - points[i][0]
    const v2y = points[i + 2][1] - points[i][1]
    const l1 = Math.hypot(v1x, v1y)
    const l2 = Math.hypot(v2x, v2y)

    if (l1 < 1 || l2 < 1) continue
    if ((v1x * v2x + v1y * v2y) / (l1 * l2) < cornerTurnCosine) corners.add(i)
  }

  return corners
}

const smoothPenPoints = (points: PenStroke, passes = 2) => {
  if (points.length < 5) return points

  const anchors = findPenCorners(points)
  const halfWindow = Math.min(4, Math.floor(points.length / 4))
  let smoothed = points

  for (let pass = 0; pass < passes; pass += 1) {
    smoothed = smoothed.map((point, index, all) => {
      if (index === 0 || index === all.length - 1 || anchors.has(index)) return point

      const start = Math.max(0, index - halfWindow)
      const end = Math.min(all.length - 1, index + halfWindow)
      let sumX = 0
      let sumY = 0

      for (let i = start; i <= end; i += 1) {
        sumX += all[i][0]
        sumY += all[i][1]
      }

      const count = end - start + 1
      return [sumX / count, sumY / count, point[2]]
    })
  }

  return smoothed
}

type DrawingPointerHandlers = Pick<
  SVGProps<SVGSVGElement>,
  'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'
>

export function usePenDrawing(renderedPreviewScale: number) {
  const activePenPointsRef = useRef<PenStroke | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [penStrokes, setPenStrokes] = useState<PenStroke[]>(
    () => readPreviewComposition()?.penStrokes ?? [],
  )
  const [, setPenTick] = useState(0)

  useEffect(() => {
    updatePreviewComposition({ penStrokes })
  }, [penStrokes])

  const getPenPoint = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return [
      (event.clientX - bounds.left) / renderedPreviewScale,
      (event.clientY - bounds.top) / renderedPreviewScale,
      event.pressure,
    ]
  }

  const startPenStroke = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    activePenPointsRef.current = [getPenPoint(event)]
    setPenTick((tick) => tick + 1)
  }

  const extendPenStroke = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!activePenPointsRef.current || event.buttons !== 1) return

    activePenPointsRef.current.push(getPenPoint(event))
    setPenTick((tick) => tick + 1)
  }

  const endPenStroke = () => {
    const points = activePenPointsRef.current
    activePenPointsRef.current = null

    if (points && points.length > 1) {
      setPenStrokes((previousStrokes) => [...previousStrokes, smoothPenPoints(points)])
    } else {
      setPenTick((tick) => tick + 1)
    }
  }

  const drawingPointerHandlers: DrawingPointerHandlers = isDrawing
    ? {
        onPointerDown: startPenStroke,
        onPointerMove: extendPenStroke,
        onPointerUp: endPenStroke,
        onPointerCancel: endPenStroke,
      }
    : {}

  return {
    isDrawing,
    hasDrawing: penStrokes.length > 0,
    strokePaths: penStrokes.map(getPenStrokePath),
    activeStrokePath: activePenPointsRef.current
      ? getPenStrokePath(activePenPointsRef.current)
      : null,
    drawingPointerHandlers,
    toggleDrawing: () => setIsDrawing((active) => !active),
    undoLastStroke: () => setPenStrokes((previousStrokes) => previousStrokes.slice(0, -1)),
    clearDrawing: () => setPenStrokes([]),
  }
}
