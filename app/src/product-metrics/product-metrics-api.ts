import express from 'express'
import type { MiddlewareConfigFn } from 'wasp/server'
import type { ProxyProductMetrics } from 'wasp/server/api'

const plausibleEventUrl = 'https://plausible.io/api/event'

export const productMetricsMiddleware: MiddlewareConfigFn = (middlewareConfig) => {
  middlewareConfig.set('express.text', express.text({ type: 'text/plain', limit: '16kb' }))
  return middlewareConfig
}

export const proxyProductMetrics: ProxyProductMetrics = async (req, res) => {
  const response = await fetch(plausibleEventUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'User-Agent': req.get('user-agent') ?? '',
      'X-Forwarded-For': req.get('cf-connecting-ip') ?? req.ip ?? '',
    },
    body: req.body,
  })

  res.status(response.status).send(await response.text())
}
