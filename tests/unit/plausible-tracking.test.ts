import { describe, expect, it } from 'vitest'
import { isAnalyticsRoute } from '../../src/product-metrics/tracked-routes'

describe('Plausible tracking routes', () => {
  it('tracks user-facing routes', () => {
    expect(isAnalyticsRoute('/')).toBe(true)
    expect(isAnalyticsRoute('/ambients')).toBe(true)
    expect(isAnalyticsRoute('/ambients/ambient-1')).toBe(true)
    expect(isAnalyticsRoute('/a/share-1/my-ambient')).toBe(true)
  })

  it('excludes admin and capability routes', () => {
    expect(isAnalyticsRoute('/admin')).toBe(false)
    expect(isAnalyticsRoute('/admin/users')).toBe(false)
    expect(isAnalyticsRoute('/agent-preview')).toBe(false)
    expect(isAnalyticsRoute('/agent-preview/secret-capability')).toBe(false)
  })
})
