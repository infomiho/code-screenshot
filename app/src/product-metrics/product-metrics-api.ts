import express from 'express'
import { env, type MiddlewareConfigFn } from 'wasp/server'
import type { ProxyProductMetrics } from 'wasp/server/api'

const plausibleEventUrl = 'https://plausible.io/api/event'
const screenshotApiUrl = 'https://api.codeshot.dev/v1/screenshots'

type ProductMetricsRequest = {
  get(name: string): string | undefined
  ip?: string
}

const plausibleRequestHeaders = (req: ProductMetricsRequest, contentType: string) => ({
  'Content-Type': contentType,
  'User-Agent': req.get('user-agent') ?? '',
  'X-Forwarded-For': req.get('cf-connecting-ip') ?? req.ip ?? '',
})

export const trackScreenshotRendered = async (
  req: ProductMetricsRequest,
  source: 'api' | 'cli',
) => {
  const domain = env.PLAUSIBLE_SITE_ID?.trim()
  if (!domain) return

  try {
    await fetch(plausibleEventUrl, {
      method: 'POST',
      headers: plausibleRequestHeaders(req, 'application/json'),
      body: JSON.stringify({
        domain,
        name: 'Screenshot Rendered',
        url: screenshotApiUrl,
        props: { source },
      }),
    })
  } catch {}
}

export const productMetricsMiddleware: MiddlewareConfigFn = (middlewareConfig) => {
  middlewareConfig.set('express.text', express.text({ type: 'text/plain', limit: '16kb' }))
  return middlewareConfig
}

export const proxyProductMetrics: ProxyProductMetrics = async (req, res) => {
  const response = await fetch(plausibleEventUrl, {
    method: 'POST',
    headers: plausibleRequestHeaders(req, 'text/plain'),
    body: req.body,
  })

  res.status(response.status).send(await response.text())
}
