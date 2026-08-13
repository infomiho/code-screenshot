import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { Config } from './config.js'
import { isAuthorized, parseScreenshotRequest } from './protocol.js'
import {
  ScreenshotServiceBusyError,
  ScreenshotServiceOutputTooLargeError,
  ScreenshotServiceTimeoutError,
  type ScreenshotService,
} from './screenshot-service.js'

const maxBodyBytes = 512 * 1024
type HttpServerConfig = Pick<Config, 'authToken' | 'captureTimeoutMs' | 'requestBodyTimeoutMs'>
type ScreenshotOperations = Pick<ScreenshotService, 'isLive' | 'capture'>

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

async function readJson(request: IncomingMessage, timeoutMs: number): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  const timeout = setTimeout(
    () => request.destroy(new Error('Request body timed out.')),
    timeoutMs,
  )
  try {
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += buffer.byteLength
      if (size > maxBodyBytes) throw new Error('Request body is too large.')
      chunks.push(buffer)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } finally {
    clearTimeout(timeout)
  }
}

export function createHttpServer(
  config: HttpServerConfig,
  screenshots: ScreenshotOperations,
): Server {
  const server = createServer(async (request, response) => {
    try {
      if (request.method === 'GET' && request.url === '/health/live') {
        const live = screenshots.isLive()
        return sendJson(response, live ? 200 : 503, { status: live ? 'live' : 'not-live' })
      }
      if (request.method === 'GET' && request.url === '/health/ready') {
        const ready = screenshots.isLive()
        return sendJson(response, ready ? 200 : 503, { status: ready ? 'ready' : 'not-ready' })
      }
      if (request.method !== 'POST' || request.url !== '/v1/screenshots') {
        return sendJson(response, 404, { error: 'Not found.' })
      }
      if (!isAuthorized(request.headers.authorization, config.authToken)) {
        response.setHeader('www-authenticate', 'Bearer')
        return sendJson(response, 401, { error: 'Unauthorized.' })
      }
      if (request.headers['content-type']?.split(';', 1)[0]?.trim() !== 'application/json') {
        return sendJson(response, 415, { error: 'Content-Type must be application/json.' })
      }

      let captureRequest
      try {
        captureRequest = parseScreenshotRequest(await readJson(request, config.requestBodyTimeoutMs))
      } catch (error) {
        return sendJson(response, 400, {
          error: error instanceof Error ? error.message : 'Invalid request body.',
        })
      }

      const png = await screenshots.capture(captureRequest)
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-length': png.byteLength,
        'content-type': 'image/png',
      })
      return response.end(png)
    } catch (error) {
      if (error instanceof ScreenshotServiceBusyError && !response.headersSent) {
        response.setHeader('retry-after', '2')
        return sendJson(response, 503, { error: error.message })
      }
      if (error instanceof ScreenshotServiceOutputTooLargeError && !response.headersSent) {
        return sendJson(response, 422, { error: error.message })
      }
      if (error instanceof ScreenshotServiceTimeoutError && !response.headersSent) {
        return sendJson(response, 504, { error: error.message })
      }
      console.error(error)
      if (!response.headersSent) sendJson(response, 500, { error: 'Screenshot capture failed.' })
      else response.destroy()
    }
  })

  server.headersTimeout = 10_000
  server.requestTimeout = config.captureTimeoutMs + 5_000
  server.keepAliveTimeout = 5_000
  return server
}
