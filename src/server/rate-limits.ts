import type { Request, RequestHandler } from 'express'
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible'
import type { MiddlewareConfigFn } from 'wasp/server'

// Wasp offers no per-operation middleware hook, so this runs globally and narrows by path itself.
// Only the writes an anonymous browser can reach are limited. The agent API, the change stream, and
// the auth routes are deliberately exempt: agents write in bursts from a single address, the change
// stream falls back to polling every 1.5s, and one office network shares a single client address.
const limitedPaths = new Set([
  '/operations/create-ambient',
  '/operations/rename-ambient',
  '/operations/create-agent-access',
  '/operations/claim-guest-ambients',
])

// Cloudflare is the coarse volumetric layer in front of this. The server limiter only catches what
// reaches the origin directly, so the ceiling is deliberately generous.
const anonymousWriteLimiter = new RateLimiterMemory({ points: 60, duration: 60 })

// Express strips the mount prefix from `req.path`, and this same chain is mounted under /operations,
// /auth, and each API route, so only the original URL identifies the operation.
const requestPath = (req: Request) => req.originalUrl.split('?')[0]

const clientAddress = (req: Request) => req.get('cf-connecting-ip') ?? req.ip ?? 'unknown'

const limitAnonymousWrites: RequestHandler = (req, res, next) => {
  if (!limitedPaths.has(requestPath(req))) {
    next()
    return
  }
  anonymousWriteLimiter.consume(clientAddress(req))
    .then(() => next())
    .catch((rejection: unknown) => {
      if (!(rejection instanceof RateLimiterRes)) {
        next(rejection)
        return
      }
      res.set('Retry-After', String(Math.ceil(rejection.msBeforeNext / 1000)))
      res.status(429).json({ message: 'Too many requests. Try again in a moment.' })
    })
}

export const serverMiddlewareFn: MiddlewareConfigFn = (middlewareConfig) => {
  middlewareConfig.set('rateLimit.anonymousWrites', limitAnonymousWrites)
  return middlewareConfig
}
