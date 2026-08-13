export type PenStroke = number[][]

type StoredPreviewComposition = {
  frameWidth?: number
  penStrokes?: PenStroke[]
}

const previewCompositionStorageKey = 'codeshot.preview-composition'

const isPenStroke = (value: unknown): value is PenStroke =>
  Array.isArray(value)
  && value.length > 1
  && value.every(
    (point) => Array.isArray(point)
      && point.length === 3
      && point.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate)),
  )

export const parsePreviewComposition = (value: string): StoredPreviewComposition | null => {
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

  const record = parsed as Record<string, unknown>
  const composition: StoredPreviewComposition = {}

  if (typeof record.frameWidth === 'number' && Number.isFinite(record.frameWidth)) {
    composition.frameWidth = record.frameWidth
  }
  if (Array.isArray(record.penStrokes) && record.penStrokes.every(isPenStroke)) {
    composition.penStrokes = record.penStrokes
  }

  return Object.keys(composition).length > 0 ? composition : null
}

export const readPreviewComposition = (): StoredPreviewComposition | null => {
  try {
    const value = globalThis.localStorage?.getItem(previewCompositionStorageKey)
    return value ? parsePreviewComposition(value) : null
  } catch {
    return null
  }
}

export const updatePreviewComposition = (update: StoredPreviewComposition) => {
  try {
    const current = readPreviewComposition() ?? {}
    globalThis.localStorage?.setItem(
      previewCompositionStorageKey,
      JSON.stringify({ ...current, ...update }),
    )
  } catch {
    // Preview editing does not depend on local persistence.
  }
}
