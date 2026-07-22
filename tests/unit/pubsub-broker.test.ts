import { describe, expect, it, vi } from 'vitest'
import { createInMemoryBroker } from '../../src/realtime/pubsub/broker'

describe('in-memory broker', () => {
  it('fans events out by key and unsubscribes idempotently', () => {
    const broker = createInMemoryBroker<string, { revision: number }>()
    const first = vi.fn()
    const second = vi.fn()
    const unsubscribe = broker.subscribe('ambient-1', first)
    broker.subscribe('ambient-2', second)

    broker.publish('ambient-1', { revision: 2 })
    unsubscribe()
    unsubscribe()
    broker.publish('ambient-1', { revision: 3 })

    expect(first).toHaveBeenCalledOnce()
    expect(first).toHaveBeenCalledWith({ revision: 2 })
    expect(second).not.toHaveBeenCalled()
  })

  it('isolates publishers and subscribers from listener failures', () => {
    const broker = createInMemoryBroker<string, void>()
    const healthy = vi.fn()
    broker.subscribe('ambient-1', () => { throw new Error('broken') })
    broker.subscribe('ambient-1', healthy)

    expect(() => broker.publish('ambient-1', undefined)).not.toThrow()
    expect(healthy).toHaveBeenCalledOnce()
  })
})
