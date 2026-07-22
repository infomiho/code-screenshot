import { api } from 'wasp/client/api'

export const openWaspSseResponse = (path: string, signal: AbortSignal) =>
  api.get(path, {
    signal,
    retry: 0,
    timeout: false,
    throwHttpErrors: false,
  })
