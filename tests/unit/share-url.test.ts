import { describe, expect, it } from 'vitest'
import { getAmbientSharePath } from '../../src/ambient/management/sharing/share-url'

describe('getAmbientSharePath', () => {
  it('builds the canonical path with encoded capability and slug segments', () => {
    expect(getAmbientSharePath('share/id', 'new name'))
      .toBe('/a/share%2Fid/new%20name')
  })
})
