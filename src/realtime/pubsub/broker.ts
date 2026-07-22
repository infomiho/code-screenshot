export type Unsubscribe = () => void

export type Broker<Key, Event> = {
  publish: (key: Key, event: Event) => void
  subscribe: (key: Key, listener: (event: Event) => void) => Unsubscribe
}

export const createInMemoryBroker = <Key, Event>(): Broker<Key, Event> => {
  const listeners = new Map<Key, Set<(event: Event) => void>>()

  return {
    publish: (key, event) => {
      listeners.get(key)?.forEach((listener) => {
        try {
          listener(event)
        } catch {
          // Publishers and other subscribers are isolated from a broken listener.
        }
      })
    },
    subscribe: (key, listener) => {
      const keyListeners = listeners.get(key) ?? new Set()
      keyListeners.add(listener)
      listeners.set(key, keyListeners)

      let subscriptionActive = true
      return () => {
        if (!subscriptionActive) return
        subscriptionActive = false
        keyListeners.delete(listener)
        if (keyListeners.size === 0) listeners.delete(key)
      }
    },
  }
}
