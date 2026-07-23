import { describe, expect, it } from 'vitest'
import { parsePreviewComposition } from '../../src/screenshot/preview-composition-storage'

describe('parsePreviewComposition', () => {
  it('reads a valid composition', () => {
    const composition = {
      frameWidth: 860,
      penStrokes: [[[10, 20, 0.5], [30, 40, 0.5]]],
    }

    expect(parsePreviewComposition(JSON.stringify(composition))).toEqual(composition)
  })

  it('preserves valid fields when another field is invalid', () => {
    expect(parsePreviewComposition('{"frameWidth":860,"penStrokes":null}')).toEqual({
      frameWidth: 860,
    })
    expect(parsePreviewComposition('{"frameWidth":"wide","penStrokes":[[[10,20,0],[30,40,0]]]}'))
      .toEqual({ penStrokes: [[[10, 20, 0], [30, 40, 0]]] })
  })

  it.each([
    'null',
    '[]',
    '{}',
    '{"frameWidth":null}',
    '{"penStrokes":[[[10,20],[30,40,0]]]}',
    '{"penStrokes":[[[10,20,0],[30,"40",0]]]}',
  ])('rejects a composition without valid fields', (value) => {
    expect(parsePreviewComposition(value)).toBeNull()
  })
})
