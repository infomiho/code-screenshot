export type Config = ReturnType<typeof loadConfig>

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function positiveInteger(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name]
  if (raw === undefined) return fallback
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`)
  }
  return value
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const captureOrigin = new URL(required(env, 'CAPTURE_ORIGIN'))
  if (captureOrigin.pathname !== '/' || captureOrigin.search || captureOrigin.hash) {
    throw new Error('CAPTURE_ORIGIN must contain only a URL origin.')
  }

  return {
    port: positiveInteger(env, 'PORT', 4100),
    authToken: required(env, 'SCREENSHOT_SERVICE_TOKEN'),
    browserExecutablePath: env.BROWSER_EXECUTABLE_PATH?.trim() || undefined,
    captureOrigin: captureOrigin.origin,
    captureConcurrency: positiveInteger(env, 'CAPTURE_CONCURRENCY', 1),
    captureTimeoutMs: positiveInteger(env, 'CAPTURE_TIMEOUT_MS', 15_000),
    requestBodyTimeoutMs: positiveInteger(env, 'REQUEST_BODY_TIMEOUT_MS', 5_000),
  }
}
