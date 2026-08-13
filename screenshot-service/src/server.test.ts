import { once } from 'node:events'
import { afterEach, describe, expect, it } from 'vitest'
import { createHttpServer } from './server.js'
import { ScreenshotServiceBusyError } from './screenshot-service.js'

const config = {
  authToken: 'service-token',
  captureTimeoutMs: 15_000,
  requestBodyTimeoutMs: 5_000,
} as const
const request = {
  code: 'const answer = 42',
  customizations: {},
  highlightedLines: [],
  language: 'typescript',
  scale: 2,
  theme: { kind: 'built-in', id: 'macos', version: 1 },
  title: 'answer.ts',
  width: 860,
} as const
const servers: ReturnType<typeof createHttpServer>[] = []

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  )
})

async function listen(screenshots: Parameters<typeof createHttpServer>[1]) {
  const server = createHttpServer(config, screenshots)
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Server address unavailable.')
  return `http://127.0.0.1:${address.port}`
}

describe('screenshot server', () => {
  it('returns PNG bytes without storing response metadata', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    const origin = await listen({ isLive: () => true, capture: async () => png })

    const response = await fetch(`${origin}/v1/screenshots`, {
      method: 'POST',
      headers: { authorization: 'Bearer service-token', 'content-type': 'application/json' },
      body: JSON.stringify(request),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(Buffer.from(await response.arrayBuffer())).toEqual(png)
  })

  it('rejects captures at capacity and tells callers when to retry', async () => {
    const origin = await listen({
      isLive: () => true,
      capture: async () => { throw new ScreenshotServiceBusyError() },
    })

    const response = await fetch(`${origin}/v1/screenshots`, {
      method: 'POST',
      headers: { authorization: 'Bearer service-token', 'content-type': 'application/json' },
      body: JSON.stringify(request),
    })

    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('2')
  })
})
