import type { ReconnectingSseConnection } from '../sse/reconnecting-client'

export const isPageVisible = () =>
  typeof document !== 'undefined' && document.visibilityState !== 'hidden'

export const bindSseToPageLifecycle = (connection: ReconnectingSseConnection) => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    connection.stop()
    return () => undefined
  }

  const onVisibilityChange = () => {
    if (isPageVisible()) connection.resume()
    else connection.pause()
  }
  const onOnline = () => {
    if (isPageVisible()) connection.reconnectNow()
  }
  const onPageShow = () => {
    if (isPageVisible()) connection.reconnectNow()
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('online', onOnline)
  window.addEventListener('pageshow', onPageShow)
  onVisibilityChange()

  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('pageshow', onPageShow)
    connection.stop()
  }
}
