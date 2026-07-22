export type CoalescedTaskRunner = {
  requestRun: () => Promise<void>
  stop: () => void
}

export const createCoalescedTaskRunner = (
  task: () => unknown | Promise<unknown>,
  onError: (error: unknown) => void = () => undefined,
): CoalescedTaskRunner => {
  let stopped = false
  let rerunRequested = false
  let activeRun: Promise<void> | null = null

  const requestRun = () => {
    if (stopped) return Promise.resolve()
    if (activeRun) {
      rerunRequested = true
      return activeRun
    }

    activeRun = (async () => {
      do {
        rerunRequested = false
        try {
          await task()
        } catch (error) {
          onError(error)
        }
      } while (rerunRequested && !stopped)
    })().finally(() => {
      activeRun = null
    })
    return activeRun
  }

  return {
    requestRun,
    stop: () => {
      stopped = true
      rerunRequested = false
    },
  }
}
