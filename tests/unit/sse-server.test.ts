import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { observeSseDisconnect, openSseServerStream } from '../../src/realtime/sse/server'

const createTransport = () => {
  const request = Object.assign(new EventEmitter(), { aborted: false })
  const response = Object.assign(new EventEmitter(), {
    writableEnded: false,
    destroyed: false,
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  })
  return { request, response }
}

describe('SSE server transport', () => {
  it('observes disconnects before response headers are opened', () => {
    const { request, response } = createTransport()
    const observation = observeSseDisconnect(request, response)

    response.emit('close')

    expect(observation.closed).toBe(true)
    expect(response.setHeader).not.toHaveBeenCalled()
  })

  it('sets streaming headers and writes encoded events', () => {
    const { request, response } = createTransport()
    const stream = openSseServerStream(request, response)

    expect(stream.sendEvent({ event: 'ready', data: '{}' })).toBe(true)
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream; charset=utf-8')
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-transform')
    expect(response.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no')
    expect(response.write).toHaveBeenCalledWith('event: ready\ndata: {}\n\n')
  })

  it('runs every cleanup once when the client leaves', () => {
    const { request, response } = createTransport()
    const stream = openSseServerStream(request, response)
    const first = vi.fn()
    const second = vi.fn()
    stream.onClose(first)
    stream.onClose(second)

    response.emit('close')
    request.emit('aborted')

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(stream.closed).toBe(true)
    expect(stream.sendEvent({ data: 'late' })).toBe(false)
  })

  it('closes explicitly and tolerates a failing cleanup', () => {
    const { request, response } = createTransport()
    const stream = openSseServerStream(request, response)
    const healthy = vi.fn()
    stream.onClose(() => { throw new Error('broken') })
    stream.onClose(healthy)

    stream.close()
    stream.close()

    expect(healthy).toHaveBeenCalledOnce()
    expect(response.end).toHaveBeenCalledOnce()
  })
})
