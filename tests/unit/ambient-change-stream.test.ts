import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  publishAmbientChange,
  streamAmbientChanges,
} from '../../src/ambient-workspace/ambient-change-stream'

const createRequest = () =>
  Object.assign(new EventEmitter(), { aborted: false, params: { ambientId: 'ambient-1' } })

const createResponse = () => {
  const response = Object.assign(new EventEmitter(), {
    writableEnded: false,
    destroyed: false,
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  })
  response.status.mockReturnValue(response)
  return response
}

const createContext = (
  user: { id: string } | null = { id: 'user-1' },
  findFirst = vi.fn().mockResolvedValue({ id: 'ambient-1' }),
) => ({
  user: user ?? undefined,
  entities: { Ambient: { findFirst } },
})

afterEach(() => vi.useRealTimers())

describe('ambient change stream', () => {
  it('authorizes the owner and forwards change events', async () => {
    vi.useFakeTimers()
    const response = createResponse()
    const context = createContext()

    await streamAmbientChanges(createRequest() as never, response as never, context as never)
    publishAmbientChange({ ambientId: 'ambient-1' })

    expect(context.entities.Ambient.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ambient-1', ownerId: 'user-1' },
    }))
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream; charset=utf-8')
    expect(response.write).toHaveBeenCalledWith('event: ambient.changed\ndata: {}\n\n')

    response.emit('close')
    response.write.mockClear()
    publishAmbientChange({ ambientId: 'ambient-1' })
    expect(response.write).not.toHaveBeenCalled()
  })

  it('rejects a signed-out request with 401', async () => {
    const response = createResponse()
    const context = createContext(null)

    await streamAmbientChanges(createRequest() as never, response as never, context as never)

    expect(response.status).toHaveBeenCalledWith(401)
    expect(context.entities.Ambient.findFirst).not.toHaveBeenCalled()
  })

  it('stops the heartbeat and unsubscribes when the stream lifetime ends', async () => {
    vi.useFakeTimers()
    const response = createResponse()

    await streamAmbientChanges(createRequest() as never, response as never, createContext() as never)

    vi.advanceTimersByTime(15_000)
    expect(response.write).toHaveBeenCalledWith(': heartbeat\n\n')

    vi.advanceTimersByTime(15 * 60_000)
    expect(response.end).toHaveBeenCalled()

    response.write.mockClear()
    publishAmbientChange({ ambientId: 'ambient-1' })
    vi.advanceTimersByTime(15_000)
    expect(response.write).not.toHaveBeenCalled()
  })

  it('keeps notifying other subscribers when one listener throws', async () => {
    const broken = createResponse()
    const healthy = createResponse()
    let brokenWrites = 0
    broken.write.mockImplementation(() => {
      brokenWrites += 1
      if (brokenWrites > 2) throw new Error('write after end')
    })

    await streamAmbientChanges(createRequest() as never, broken as never, createContext() as never)
    await streamAmbientChanges(createRequest() as never, healthy as never, createContext() as never)
    healthy.write.mockClear()

    expect(() => publishAmbientChange({ ambientId: 'ambient-1' })).not.toThrow()
    expect(healthy.write).toHaveBeenCalledWith('event: ambient.changed\ndata: {}\n\n')

    broken.emit('close')
    healthy.emit('close')
  })

  it('does not open a stream for another user', async () => {
    const response = createResponse()
    const context = createContext({ id: 'user-2' }, vi.fn().mockResolvedValue(null))

    await streamAmbientChanges(createRequest() as never, response as never, context as never)

    expect(response.status).toHaveBeenCalledWith(404)
    expect(response.flushHeaders).not.toHaveBeenCalled()
  })

  it('does not subscribe when the response closes during authorization', async () => {
    let finishAuthorization: (ambient: { id: string }) => void = () => undefined
    const response = createResponse()
    const findFirst = vi.fn().mockReturnValue(new Promise((resolve) => {
      finishAuthorization = resolve
    }))
    const streaming = streamAmbientChanges(
      createRequest() as never,
      response as never,
      createContext({ id: 'user-1' }, findFirst) as never,
    )

    response.emit('close')
    finishAuthorization({ id: 'ambient-1' })
    await streaming
    publishAmbientChange({ ambientId: 'ambient-1' })

    expect(response.write).not.toHaveBeenCalled()
    expect(response.setHeader).not.toHaveBeenCalled()
  })
})
