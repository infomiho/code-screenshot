import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { logout, useAuth } from 'wasp/client/auth'
import { routes } from 'wasp/client/router'
import {
  getAdminAccess,
  getAdminDashboard,
  getAdminPlausibleSnapshot,
  refreshAdminPlausibleSnapshot,
  useQuery,
} from 'wasp/client/operations'
import type { PlausibleSnapshotDto } from './contracts'

export function useAdminDashboard() {
  const navigate = useNavigate()
  const accountQuery = useAuth()
  const accessQuery = useQuery(getAdminAccess, undefined, { retry: false })
  const hasAccess = accessQuery.data?.isAdmin === true
  const dashboardQuery = useQuery(getAdminDashboard, undefined, { enabled: hasAccess, retry: false })
  const plausibleQuery = useQuery(getAdminPlausibleSnapshot, undefined, { enabled: hasAccess, retry: false })
  const [refreshedSnapshot, setRefreshedSnapshot] = useState<PlausibleSnapshotDto | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshFailed, setRefreshFailed] = useState(false)

  useEffect(() => {
    if (accessQuery.data && !accessQuery.data.isAdmin) navigate(routes.RootRoute.to, { replace: true })
  }, [accessQuery.data, navigate])

  const refreshPlausible = async () => {
    setIsRefreshing(true)
    setRefreshFailed(false)
    try {
      setRefreshedSnapshot(await refreshAdminPlausibleSnapshot())
    } catch {
      setRefreshFailed(true)
    } finally {
      setIsRefreshing(false)
    }
  }

  const signOut = async () => {
    await logout()
    navigate(routes.RootRoute.to, { replace: true })
  }

  return {
    hasAccess,
    isCheckingAccess: accessQuery.isLoading || accountQuery.isLoading,
    hasAccessError: Boolean(accessQuery.error || accountQuery.error),
    retryAccess: () => {
      void accountQuery.refetch()
      void accessQuery.refetch()
    },
    account: accountQuery.data ? {
      username: accountQuery.data.githubLogin,
      avatarUrl: accountQuery.data.githubAvatarUrl ?? null,
      onSignOut: () => void signOut(),
    } : null,
    dashboard: {
      data: dashboardQuery.data,
      isLoading: dashboardQuery.isLoading,
      hasError: Boolean(dashboardQuery.error),
      retry: () => void dashboardQuery.refetch(),
    },
    plausible: {
      snapshot: refreshedSnapshot ?? plausibleQuery.data,
      isLoading: plausibleQuery.isLoading,
      isRefreshing,
      refreshFailed,
      refresh: () => void refreshPlausible(),
    },
  }
}
