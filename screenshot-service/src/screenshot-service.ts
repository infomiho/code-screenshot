import { chromium, type Browser } from 'playwright'
import type { Config } from './config.js'
import type { ScreenshotRequest } from './protocol.js'

const capturePath = '/internal/render/screenshot'
const maxOutputHeight = 4_000
const maxOutputPixels = 20_000_000

export class ScreenshotService {
  readonly #config: Config
  #browser: Browser | undefined
  #browserLaunch: Promise<Browser> | undefined
  #activeCaptures = 0

  constructor(config: Config) {
    this.#config = config
  }

  async start(): Promise<void> {
    await this.#getBrowser()
  }

  isLive(): boolean {
    return this.#browser?.isConnected() ?? false
  }

  async capture(request: ScreenshotRequest): Promise<Buffer> {
    if (this.#activeCaptures >= this.#config.captureConcurrency) {
      throw new ScreenshotServiceBusyError()
    }
    this.#activeCaptures += 1
    try {
      return await this.#capture(request)
    } finally {
      this.#activeCaptures -= 1
    }
  }

  async #capture(request: ScreenshotRequest): Promise<Buffer> {
    const deadline = Date.now() + this.#config.captureTimeoutMs
    const browser = await this.#getBrowser(deadline)
    const context = await this.#beforeDeadline(browser.newContext({
      viewport: { width: request.width, height: 900 },
      deviceScaleFactor: request.scale,
    }), deadline)
    let timeout: NodeJS.Timeout | undefined
    try {
      return await Promise.race([
        this.#capturePage(context, request),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            void context.close()
            reject(new ScreenshotServiceTimeoutError())
          }, this.#remainingTime(deadline))
        }),
      ])
    } finally {
      clearTimeout(timeout)
      await context.close().catch(() => undefined)
    }
  }

  async #capturePage(
    context: Awaited<ReturnType<Browser['newContext']>>,
    request: ScreenshotRequest,
  ): Promise<Buffer> {
    const page = await context.newPage()
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (url.origin === this.#config.captureOrigin) await route.continue()
      else await route.abort()
    })
    await page.addInitScript((renderRequest) => {
      ;(window as Window & { __CODESHOT_RENDER_REQUEST__?: ScreenshotRequest })
        .__CODESHOT_RENDER_REQUEST__ = renderRequest
    }, request)
    await page.goto(`${this.#config.captureOrigin}${capturePath}`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => {
      const state = document.querySelector('.screenshot-render-page')?.getAttribute('data-screenshot-state')
      if (state === 'error') throw new Error('Screenshot page rejected the render request.')
      return state === 'ready'
    })
    await page.evaluate(async () => {
      await document.fonts.ready
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })
    const frame = page.locator('.shot-frame')
    const bounds = await frame.boundingBox()
    if (!bounds) throw new Error('Screenshot frame is unavailable.')
    const outputPixels = bounds.width * bounds.height * request.scale ** 2
    if (bounds.height > maxOutputHeight || outputPixels > maxOutputPixels) {
      throw new ScreenshotServiceOutputTooLargeError()
    }
    return await frame.screenshot({ type: 'png' })
  }

  async #getBrowser(deadline = Date.now() + this.#config.captureTimeoutMs): Promise<Browser> {
    if (this.#browser?.isConnected()) return this.#browser
    if (!this.#browserLaunch) {
      this.#browserLaunch = chromium.launch({
        headless: true,
        executablePath: this.#config.browserExecutablePath,
        timeout: this.#remainingTime(deadline),
      }).then((browser) => {
        this.#browser = browser
        browser.once('disconnected', () => {
          if (this.#browser === browser) this.#browser = undefined
        })
        return browser
      }).finally(() => {
        this.#browserLaunch = undefined
      })
    }
    return this.#beforeDeadline(this.#browserLaunch, deadline)
  }

  async #beforeDeadline<Value>(promise: Promise<Value>, deadline: number): Promise<Value> {
    let timeout: NodeJS.Timeout | undefined
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new ScreenshotServiceTimeoutError()),
            this.#remainingTime(deadline),
          )
        }),
      ])
    } finally {
      clearTimeout(timeout)
    }
  }

  #remainingTime(deadline: number): number {
    return Math.max(1, deadline - Date.now())
  }

  async close(): Promise<void> {
    await this.#browser?.close().catch(() => undefined)
    this.#browser = undefined
  }
}

export class ScreenshotServiceBusyError extends Error {
  constructor() {
    super('Screenshot service is at capacity.')
  }
}

export class ScreenshotServiceTimeoutError extends Error {
  constructor() {
    super('Screenshot capture timed out.')
  }
}

export class ScreenshotServiceOutputTooLargeError extends Error {
  constructor() {
    super('Screenshot output is too large.')
  }
}
