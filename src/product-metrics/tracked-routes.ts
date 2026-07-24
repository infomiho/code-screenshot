import { routes } from 'wasp/client/router'

const agentPreviewRoot = routes.AgentPreviewRoute.to.split('/:')[0]

export const isAnalyticsRoute = (pathname: string) =>
  pathname !== routes.AdminRoute.to
  && !pathname.startsWith(`${routes.AdminRoute.to}/`)
  && pathname !== agentPreviewRoot
  && !pathname.startsWith(`${agentPreviewRoot}/`)
