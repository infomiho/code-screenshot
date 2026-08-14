import express from 'express'
import { env, type MiddlewareConfigFn } from 'wasp/server'
import type { GetScreenshotCapabilities, RenderScreenshot, ResolveScreenshotTheme } from 'wasp/server/api'
import { z } from 'zod'
import { compileAmbientDocument } from '../ambient/compiler'
import { builtInThemes, findBuiltInTheme } from '../ambient/rendering/built-in-theme-catalog'
import { trackScreenshotRendered } from '../product-metrics/product-metrics-api'
import { isLanguageId, languageOptions } from './language-catalog'
import type { RenderTheme, ScreenshotRenderRequest } from './render-contract'

const requestSchema = z.strictObject({
  code: z.string().max(50_000),
  customizations: z.record(z.string().max(128), z.string().max(512)).default({}),
  highlightedLines: z.array(z.number().int().positive()).max(1_000).default([]),
  language: z.string().min(1).max(64),
  scale: z.union([z.literal(1), z.literal(2)]).default(2),
  theme: z.string().trim().min(1).max(512).default('macos'),
  title: z.string().max(256).default(''),
  width: z.number().int().min(420).max(1280).default(860),
})

type ScreenshotApiContext = Parameters<RenderScreenshot>[2]
type ApiErrorCode =
  | 'invalid_request'
  | 'unknown_language'
  | 'unknown_theme'
  | 'render_capacity_exceeded'
  | 'render_failed'
  | 'render_output_too_large'
  | 'render_timeout'

class ScreenshotApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message)
  }
}

export const screenshotApiMiddleware: MiddlewareConfigFn = (middlewareConfig) => {
  middlewareConfig.set('express.json', express.json({ limit: '256kb' }))
  return middlewareConfig
}

const parseThemeReference = (reference: string) => {
  let normalized = reference
  try {
    const url = new URL(reference)
    if (url.origin !== 'https://codeshot.dev') throw new Error()
    const match = url.pathname.match(/^\/a\/([^/]+)(?:\/|$)/)
    if (!match) throw new Error()
    normalized = `share:${decodeURIComponent(match[1])}`
  } catch (error) {
    if (/^https?:\/\//i.test(reference)) throw new ScreenshotApiError(404, 'unknown_theme', 'Theme is unavailable.')
  }

  const shared = normalized.match(/^share:([^@]+?)(?:@(\d+))?$/)
  if (shared) return { kind: 'shared' as const, id: shared[1], version: shared[2] ? Number(shared[2]) : undefined }

  const builtIn = normalized.match(/^(?:builtin:)?([^@]+?)(?:@(\d+))?$/)
  if (builtIn) return { kind: 'built-in' as const, id: builtIn[1], version: builtIn[2] ? Number(builtIn[2]) : undefined }

  throw new ScreenshotApiError(404, 'unknown_theme', 'Theme is unavailable.')
}

const resolveTheme = async (
  reference: string,
  context: ScreenshotApiContext,
): Promise<{ theme: RenderTheme; reference: string }> => {
  const parsed = parseThemeReference(reference)
  if (parsed.kind === 'built-in') {
    const theme = findBuiltInTheme(parsed.id, parsed.version)
    if (!theme) throw new ScreenshotApiError(404, 'unknown_theme', 'Theme is unavailable.')
    return {
      theme: { kind: 'built-in', ...theme },
      reference: `builtin:${theme.id}@${theme.version}`,
    }
  }

  const ambient = await context.entities.Ambient.findFirst({
    where: { shareId: parsed.id, linkSharingEnabled: true, currentVersion: { not: null } },
    select: { id: true, currentVersion: true },
  })
  if (!ambient?.currentVersion) throw new ScreenshotApiError(404, 'unknown_theme', 'Theme is unavailable.')

  const versionNumber = parsed.version ?? ambient.currentVersion
  const version = await context.entities.AmbientVersion.findUnique({
    where: { ambientId_version: { ambientId: ambient.id, version: versionNumber } },
    select: { document: true, version: true },
  })
  if (!version) throw new ScreenshotApiError(404, 'unknown_theme', 'Theme is unavailable.')

  const compiled = compileAmbientDocument(version.document)
  if (!compiled.compiled) throw new ScreenshotApiError(500, 'render_failed', 'Stored theme is invalid.')
  return {
    theme: {
      kind: 'declarative',
      id: ambient.id,
      version: version.version,
      document: compiled.compiled.document,
    },
    reference: `share:${parsed.id}@${version.version}`,
  }
}

export const getScreenshotCapabilities: GetScreenshotCapabilities = (_req, res) => {
  res.json({
    endpoint: '/v1/screenshots',
    limits: { codeLength: 50_000, width: { min: 420, max: 1280 }, scales: [1, 2] },
    languages: languageOptions.map(({ id, label }) => ({ id, label })),
    themes: builtInThemes.map(({ id, version }) => ({ id, version, reference: `builtin:${id}@${version}` })),
  })
}

export const resolveScreenshotTheme: ResolveScreenshotTheme = async (req, res, context) => {
  try {
    const reference = typeof req.query.theme === 'string' ? req.query.theme : ''
    if (!reference) throw new ScreenshotApiError(400, 'invalid_request', 'Theme is required.')
    const resolved = await resolveTheme(reference, context)
    res.json({
      reference: resolved.reference,
      kind: resolved.theme.kind,
      id: resolved.theme.id,
      version: resolved.theme.version,
    })
  } catch (error) {
    const apiError = error instanceof ScreenshotApiError
      ? error
      : new ScreenshotApiError(500, 'render_failed', 'Theme resolution failed.')
    res.status(apiError.status).json({ code: apiError.code, message: apiError.message })
  }
}

const rendererError = (response: Response): ScreenshotApiError => {
  if (response.status === 503) {
    return new ScreenshotApiError(503, 'render_capacity_exceeded', 'Renderer is busy. Try again shortly.')
  }
  if (response.status === 504) {
    return new ScreenshotApiError(504, 'render_timeout', 'Screenshot rendering timed out.')
  }
  if (response.status === 422) {
    return new ScreenshotApiError(422, 'render_output_too_large', 'Rendered screenshot is too large.')
  }
  return new ScreenshotApiError(502, 'render_failed', 'Screenshot rendering failed.')
}

const readPng = async (response: Response): Promise<Buffer> => {
  if (response.headers.get('content-type')?.split(';', 1)[0] !== 'image/png') {
    throw new ScreenshotApiError(502, 'render_failed', 'Screenshot rendering failed.')
  }
  const png = Buffer.from(await response.arrayBuffer())
  if (png.byteLength < 8 || !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new ScreenshotApiError(502, 'render_failed', 'Screenshot rendering failed.')
  }
  return png
}

export const renderScreenshot: RenderScreenshot = async (req, res, context) => {
  try {
    const parsed = requestSchema.safeParse(req.body)
    if (!parsed.success) throw new ScreenshotApiError(400, 'invalid_request', 'Invalid screenshot request.')
    if (!isLanguageId(parsed.data.language)) {
      throw new ScreenshotApiError(400, 'unknown_language', `Unknown language: ${parsed.data.language}`)
    }

    const resolvedTheme = await resolveTheme(parsed.data.theme, context)
    const request: ScreenshotRenderRequest = {
      ...parsed.data,
      theme: resolvedTheme.theme,
    }
    const response = await fetch(`${env.SCREENSHOT_SERVICE_URL}/v1/screenshots`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SCREENSHOT_SERVICE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) throw rendererError(response)

    const png = await readPng(response)
    res.set({
      'Cache-Control': 'no-store',
      'Content-Length': String(png.byteLength),
      'Content-Type': 'image/png',
      'X-Codeshot-Theme': resolvedTheme.reference,
    })
    res.status(200).send(png)
    void trackScreenshotRendered(req, req.get('x-codeshot-client') === 'cli' ? 'cli' : 'api')
  } catch (error) {
    const apiError = error instanceof ScreenshotApiError
      ? error
      : error instanceof DOMException && error.name === 'TimeoutError'
        ? new ScreenshotApiError(504, 'render_timeout', 'Screenshot rendering timed out.')
        : new ScreenshotApiError(502, 'render_failed', 'Screenshot rendering failed.')
    res.status(apiError.status).json({ code: apiError.code, message: apiError.message })
  }
}
