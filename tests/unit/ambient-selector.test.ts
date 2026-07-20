import { describe, expect, it } from 'vitest'
import { getVerticalAmbientIndex } from '../../src/ambient-selector'

describe('getVerticalAmbientIndex', () => {
  it('wraps vertically within both built-in columns', () => {
    expect(getVerticalAmbientIndex(0, -1, 6, 6)).toBe(4)
    expect(getVerticalAmbientIndex(1, -1, 6, 6)).toBe(5)
    expect(getVerticalAmbientIndex(4, 1, 6, 6)).toBe(0)
    expect(getVerticalAmbientIndex(5, 1, 6, 6)).toBe(1)
  })

  it('moves explicitly between built-in and personal sections', () => {
    expect(getVerticalAmbientIndex(4, 1, 6, 8)).toBe(6)
    expect(getVerticalAmbientIndex(5, 1, 6, 8)).toBe(6)
    expect(getVerticalAmbientIndex(6, -1, 6, 8)).toBe(5)
    expect(getVerticalAmbientIndex(7, 1, 6, 8)).toBe(0)
  })
})
