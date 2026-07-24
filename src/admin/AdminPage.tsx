import { useEffect } from 'react'
import { AdminDashboardView } from './components/AdminDashboardView'
import { AdminPageSkeleton } from './components/AdminSectionSkeletons'
import { useAdminDashboard } from './use-admin-dashboard'

export function AdminPage() {
  const admin = useAdminDashboard()

  useEffect(() => {
    document.title = 'Admin | codeshot.dev'
  }, [])

  if (admin.hasAccessError) {
    return (
      <main className="admin-access-state" role="alert">
        <p>Could not verify admin access.</p>
        <button className="ui-button" type="button" onClick={admin.retryAccess}>Try again</button>
      </main>
    )
  }

  if (admin.isCheckingAccess || !admin.hasAccess || !admin.account) {
    return <AdminPageSkeleton />
  }

  return <AdminDashboardView
    account={admin.account}
    dashboard={admin.dashboard.data}
    isDashboardLoading={admin.dashboard.isLoading}
    dashboardHasError={admin.dashboard.hasError}
    plausibleSnapshot={admin.plausible.snapshot}
    isPlausibleLoading={admin.plausible.isLoading}
    isPlausibleRefreshing={admin.plausible.isRefreshing}
    plausibleRefreshFailed={admin.plausible.refreshFailed}
    onDashboardRetry={admin.dashboard.retry}
    onPlausibleRefresh={admin.plausible.refresh}
  />
}
