import { describe, expect, it } from 'vitest'
import { getVerticalAmbientIndex } from '../../src/ambient-selector'

describe('getVerticalAmbientIndex', () => {
  it('wraps vertically within both built-in columns', () => {
    expect(getVerticalAmbientIndex(0, -1, 6, 6)).toBe(4)
    expect(getVerticalAmbientIndex(1, -1, 6, 6)).toBe(5)
    expect(getVerticalAmbientIndex(4, 1, 6, 6)).toBe(0)
    expect(getVerticalAmbientIndex(5, 1, 6, 6)).toBe(1)
  })

  it('moves between built-in and personal grids keeping the column', () => {
    expect(getVerticalAmbientIndex(4, 1, 6, 8)).toBe(6)
    expect(getVerticalAmbientIndex(5, 1, 6, 8)).toBe(7)
    expect(getVerticalAmbientIndex(6, -1, 6, 8)).toBe(4)
    expect(getVerticalAmbientIndex(7, -1, 6, 8)).toBe(5)
    expect(getVerticalAmbientIndex(7, 1, 6, 8)).toBe(1)
    expect(getVerticalAmbientIndex(6, 1, 6, 8)).toBe(0)
  })

  it('clamps to the last item when the target grid row is partial', () => {
    expect(getVerticalAmbientIndex(5, 1, 6, 7)).toBe(6)
    expect(getVerticalAmbientIndex(1, -1, 6, 7)).toBe(6)
  })
})
