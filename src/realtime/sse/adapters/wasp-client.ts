import { api } from 'wasp/client/api'

export const openWaspSseResponse = (
  path: string,
  signal: AbortSignal,
  headers?: Record<string, string>,
) =>
  api.get(path, {
    signal,
    retry: 0,
    timeout: false,
    throwHttpErrors: false,
    headers,
  })
