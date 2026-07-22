export type PollingFallback = {
  start: () => void
  pause: () => void
  stop: () => void
}

export type PollingFallbackOptions = {
  poll: () => Promise<void>
  intervalMs?: number
  shouldPoll?: () => boolean
}

export const createPollingFallback = ({
  poll,
  intervalMs = 1_500,
  shouldPoll = () => true,
}: PollingFallbackOptions): PollingFallback => {
  let stopped = false
  let running = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const clear = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  const schedule = () => {
    if (stopped || !running || timer !== null) return
    timer = setTimeout(() => {
      timer = null
      const pollPromise = shouldPoll() ? poll() : Promise.resolve()
      void pollPromise.finally(schedule)
    }, intervalMs)
  }

  return {
    start: () => {
      running = true
      schedule()
    },
    pause: () => {
      running = false
      clear()
    },
    stop: () => {
      stopped = true
      running = false
      clear()
    },
  }
}
