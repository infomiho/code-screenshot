import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  publishAmbientChange,
  streamAmbientChanges,
} from '../../src/ambient-workspace/ambient-change-stream'

const createResponse = () => {
  const emitter = new EventEmitter()
  return Object.assign(emitter, {
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  })
}

afterEach(() => vi.useRealTimers())

describe('ambient change stream', () => {
  it('authorizes the owner and forwards change events', async () => {
    vi.useFakeTimers()
    const request = Object.assign(new EventEmitter(), { params: { ambientId: 'ambient-1' } })
    const response = createResponse()
    response.status.mockReturnValue(response)
    const findFirst = vi.fn().mockResolvedValue({ id: 'ambient-1' })

    await streamAmbientChanges(request as never, response as never, {
      user: { id: 'user-1' },
      entities: { Ambient: { findFirst } },
    } as never)
    publishAmbientChange({ ambientId: 'ambient-1' })

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ambient-1', ownerId: 'user-1' },
    }))
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream; charset=utf-8')
    expect(response.write).toHaveBeenCalledWith('event: ambient-change\n')

    response.emit('close')
    response.write.mockClear()
    publishAmbientChange({ ambientId: 'ambient-1' })
    expect(response.write).not.toHaveBeenCalled()
  })

  it('does not open a stream for another user', async () => {
    const request = Object.assign(new EventEmitter(), { params: { ambientId: 'ambient-1' } })
    const response = createResponse()
    response.status.mockReturnValue(response)

    await streamAmbientChanges(request as never, response as never, {
      user: { id: 'user-2' },
      entities: { Ambient: { findFirst: vi.fn().mockResolvedValue(null) } },
    } as never)

    expect(response.status).toHaveBeenCalledWith(404)
    expect(response.flushHeaders).not.toHaveBeenCalled()
  })

  it('does not subscribe when the response closes during authorization', async () => {
    let finishAuthorization: (ambient: { id: string }) => void = () => undefined
    const request = Object.assign(new EventEmitter(), {
      aborted: false,
      params: { ambientId: 'ambient-1' },
    })
    const response = Object.assign(createResponse(), { destroyed: false })
    response.status.mockReturnValue(response)
    const findFirst = vi.fn().mockReturnValue(new Promise((resolve) => {
      finishAuthorization = resolve
    }))
    const streaming = streamAmbientChanges(request as never, response as never, {
      user: { id: 'user-1' },
      entities: { Ambient: { findFirst } },
    } as never)

    response.emit('close')
    finishAuthorization({ id: 'ambient-1' })
    await streaming
    publishAmbientChange({ ambientId: 'ambient-1' })

    expect(response.write).not.toHaveBeenCalled()
    expect(response.setHeader).not.toHaveBeenCalled()
  })
})
