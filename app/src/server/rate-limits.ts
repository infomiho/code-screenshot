import type { Request, RequestHandler } from 'express'
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible'
import type { MiddlewareConfigFn } from 'wasp/server'

// Wasp has no per-operation middleware hook, so this runs globally and narrows by path itself.
// The agent API, change stream and auth routes stay exempt: agents burst from one address and the
// change stream polls every 1.5s, so limiting them would punish normal use.
const limitedPaths = new Set([
  '/operations/create-ambient',
  '/operations/copy-shared-ambient',
  '/operations/rename-ambient',
  '/operations/create-agent-access',
  '/operations/discard-agent-access',
  '/operations/discard-ambient-draft',
  '/operations/delete-ambient',
  '/operations/claim-guest-ambients',
])

// Cloudflare is the volumetric layer; this only catches what reaches the origin directly.
const anonymousWriteLimiter = new RateLimiterMemory({ points: 60, duration: 60 })

// `req.path` loses the mount prefix, and the router ignores case and trailing slashes, so matching
// on anything less than a normalized `originalUrl` is skipped by asking for `/Create-Ambient/`.
const requestPath = (req: Request) =>
  req.originalUrl.split('?')[0].toLowerCase().replace(/\/+$/, '')

const clientAddress = (req: Request) => req.get('cf-connecting-ip') ?? req.ip ?? 'unknown'

// Runs before auth, so there is no user yet. Bucketing by session keeps one abusive visitor from
// spending the budget for everyone behind the same office address.
const limiterKey = (req: Request) => req.get('Authorization') ?? clientAddress(req)

const limitAnonymousWrites: RequestHandler = (req, res, next) => {
  if (!limitedPaths.has(requestPath(req))) {
    next()
    return
  }
  anonymousWriteLimiter.consume(limiterKey(req))
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
