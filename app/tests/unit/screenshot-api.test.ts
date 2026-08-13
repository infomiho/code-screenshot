import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('wasp/server', () => ({
  env: {
    SCREENSHOT_SERVICE_TOKEN: 'internal-token',
    SCREENSHOT_SERVICE_URL: 'http://renderer.internal:4100',
  },
}))

import {
  getScreenshotCapabilities,
  renderScreenshot,
  resolveScreenshotTheme,
} from '../../src/screenshot/screenshot-api'
import { swissPosterDocument } from '../../src/ambient/rendering/themes/swiss-poster'

const baseRequest = {
  code: 'const answer = 42',
  language: 'typescript',
  theme: 'macos',
}

const createResponse = () => {
  const response = {
    json: vi.fn(),
    send: vi.fn(),
    set: vi.fn(),
    status: vi.fn(),
  }
  response.status.mockReturnValue(response)
  response.set.mockReturnValue(response)
  return response
}

const createRequest = (body: unknown) => ({ body })

const createContext = (options: { ambient?: unknown; version?: unknown } = {}) => ({
  entities: {
    Ambient: { findFirst: vi.fn().mockResolvedValue(options.ambient ?? null) },
    AmbientVersion: { findUnique: vi.fn().mockResolvedValue(options.version ?? null) },
  },
})

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const pngResponse = () => new Response(png, {
  status: 200,
  headers: { 'content-type': 'image/png' },
})

describe('public screenshot API', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pngResponse())))

  it('resolves a built-in theme and relays PNG bytes', async () => {
    const response = createResponse()
    await renderScreenshot(createRequest(baseRequest) as never, response as never, createContext() as never)

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('http://renderer.internal:4100/v1/screenshots')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer internal-token')
    expect(JSON.parse(String(init?.body))).toEqual({
      code: baseRequest.code,
      customizations: {},
      highlightedLines: [],
      language: 'typescript',
      scale: 2,
      theme: { kind: 'built-in', id: 'macos', version: 1 },
      title: '',
      width: 860,
    })
    expect(response.set).toHaveBeenCalledWith(expect.objectContaining({
      'Cache-Control': 'no-store',
      'Content-Length': '8',
      'Content-Type': 'image/png',
      'X-Codeshot-Theme': 'builtin:macos@1',
    }))
    expect(response.send).toHaveBeenCalledWith(png)
  })

  it('resolves a pinned version of a shared theme', async () => {
    const context = createContext({
      ambient: { id: 'ambient-1', currentVersion: 3 },
      version: { version: 2, document: swissPosterDocument },
    })
    await renderScreenshot(
      createRequest({ ...baseRequest, theme: 'share:abcdefghijklmnopqrstuv@2' }) as never,
      createResponse() as never,
      context as never,
    )

    expect(context.entities.AmbientVersion.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { ambientId_version: { ambientId: 'ambient-1', version: 2 } },
    }))
    const request = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))
    expect(request.theme).toEqual({
      kind: 'declarative',
      id: 'ambient-1',
      version: 2,
      document: swissPosterDocument,
    })
  })

  it.each([
    [{ ...baseRequest, language: 'brainfuck' }, 400, 'unknown_language'],
    [{ ...baseRequest, theme: 'macos@99' }, 404, 'unknown_theme'],
  ])('rejects invalid public input', async (body, status, code) => {
    const response = createResponse()
    await renderScreenshot(createRequest(body) as never, response as never, createContext() as never)

    expect(fetch).not.toHaveBeenCalled()
    expect(response.status).toHaveBeenCalledWith(status)
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code }))
  })

  it('maps renderer capacity without exposing private details', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{"error":"private detail"}', { status: 503 }))
    const response = createResponse()
    await renderScreenshot(createRequest(baseRequest) as never, response as never, createContext() as never)

    expect(response.status).toHaveBeenCalledWith(503)
    expect(response.json).toHaveBeenCalledWith({
      code: 'render_capacity_exceeded',
      message: 'Renderer is busy. Try again shortly.',
    })
  })

  it('advertises rendering capabilities', () => {
    const response = createResponse()
    getScreenshotCapabilities({} as never, response as never, createContext() as never)

    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: '/v1/screenshots',
      languages: expect.arrayContaining([{ id: 'typescript', label: 'TypeScript' }]),
      themes: expect.arrayContaining([{ id: 'macos', version: 1, reference: 'builtin:macos@1' }]),
    }))
  })

  it('resolves a public theme reference without exposing its document', async () => {
    const response = createResponse()
    await resolveScreenshotTheme(
      { query: { theme: 'macos' } } as never,
      response as never,
      createContext() as never,
    )

    expect(response.json).toHaveBeenCalledWith({
      reference: 'builtin:macos@1',
      kind: 'built-in',
      id: 'macos',
      version: 1,
    })
  })
})
