import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bindSseToPageLifecycle } from '../../src/realtime/browser/page-lifecycle'
import type { ReconnectingSseConnection } from '../../src/realtime/sse/reconnecting-client'

const createConnection = () => ({
  ready: false,
  pause: vi.fn(),
  resume: vi.fn(),
  reconnect: vi.fn(),
  reconnectNow: vi.fn(),
  stop: vi.fn(),
}) satisfies ReconnectingSseConnection

describe('page lifecycle', () => {
  let page: EventTarget & { visibilityState: string }
  let browserWindow: EventTarget

  beforeEach(() => {
    page = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    browserWindow = new EventTarget()
    vi.stubGlobal('document', page)
    vi.stubGlobal('window', browserWindow)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('starts active, pauses while hidden, and resumes when visible', () => {
    const connection = createConnection()
    const stop = bindSseToPageLifecycle(connection)
    expect(connection.resume).toHaveBeenCalledOnce()

    page.visibilityState = 'hidden'
    page.dispatchEvent(new Event('visibilitychange'))
    expect(connection.pause).toHaveBeenCalledOnce()

    page.visibilityState = 'visible'
    page.dispatchEvent(new Event('visibilitychange'))
    expect(connection.resume).toHaveBeenCalledTimes(2)

    stop()
    expect(connection.stop).toHaveBeenCalledOnce()
  })

  it('reconnects immediately after network recovery or page restore', () => {
    const connection = createConnection()
    const stop = bindSseToPageLifecycle(connection)

    browserWindow.dispatchEvent(new Event('online'))
    browserWindow.dispatchEvent(new Event('pageshow'))

    expect(connection.reconnectNow).toHaveBeenCalledTimes(2)
    stop()
  })
})
