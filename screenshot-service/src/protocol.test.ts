import { describe, expect, it } from 'vitest'
import { isAuthorized, parseScreenshotRequest } from './protocol.js'

const request = {
  code: 'const answer = 42',
  customizations: {},
  highlightedLines: [1],
  language: 'typescript',
  scale: 2,
  theme: { kind: 'built-in', id: 'macos', version: 1 },
  title: 'answer.ts',
  width: 860,
} as const

describe('parseScreenshotRequest', () => {
  it('accepts a bounded built-in theme render request', () => {
    expect(parseScreenshotRequest(request)).toEqual(request)
  })

  it('rejects unsupported dimensions and unknown properties', () => {
    expect(() => parseScreenshotRequest({ ...request, width: 200 })).toThrow('Invalid request body')
    expect(() => parseScreenshotRequest({ ...request, outputPath: '/tmp/shot.png' })).toThrow(
      'Invalid request body',
    )
  })
})

describe('isAuthorized', () => {
  it('accepts only the exact Bearer token', () => {
    expect(isAuthorized('Bearer local-token', 'local-token')).toBe(true)
    expect(isAuthorized('Bearer wrong-token', 'local-token')).toBe(false)
    expect(isAuthorized('Basic local-token', 'local-token')).toBe(false)
  })
})
