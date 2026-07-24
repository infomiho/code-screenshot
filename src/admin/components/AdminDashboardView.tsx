import { useNavigate } from 'react-router'
import { routes } from 'wasp/client/router'
import type { AdminDashboardDto, PlausibleSnapshotDto } from '../contracts'
import { DatabaseSection } from './DatabaseSection'
import { PlausibleSection } from './PlausibleSection'
import { AccountMenu } from '../../account/account-menu'
import { AdminPageFrame } from './AdminPageFrame'
import '../../index.css'
import '../admin.css'

type AdminDashboardViewProps = {
  account: {
    username: string
    avatarUrl: string | null
    onSignOut: () => void
  }
  dashboard?: AdminDashboardDto
  isDashboardLoading: boolean
  dashboardHasError: boolean
  plausibleSnapshot?: PlausibleSnapshotDto
  isPlausibleLoading: boolean
  isPlausibleRefreshing: boolean
  plausibleRefreshFailed: boolean
  onDashboardRetry: () => void
  onPlausibleRefresh: () => void
}

export function AdminDashboardView({
  account,
  dashboard,
  isDashboardLoading,
  dashboardHasError,
  plausibleSnapshot,
  isPlausibleLoading,
  isPlausibleRefreshing,
  plausibleRefreshFailed,
  onDashboardRetry,
  onPlausibleRefresh,
}: AdminDashboardViewProps) {
  const navigate = useNavigate()

  return (
    <AdminPageFrame header={(
      <>
        <button className="subpage-back-button" type="button" aria-label="Back to editor" onClick={() => navigate(routes.RootRoute.to)}>
          <span className="subpage-back-arrow" aria-hidden="true">←</span>
          <span className="subpage-back-label">Back to editor</span>
        </button>
        <AccountMenu
          username={account.username}
          avatarUrl={account.avatarUrl}
          onOpenLibrary={() => navigate(routes.YourAmbientsRoute.to)}
          onOpenAdmin={() => navigate(routes.AdminRoute.to)}
          onSignOut={account.onSignOut}
        />
      </>
    )}>
      <div className="admin-heading">
        <h1>Admin</h1>
      </div>
      <DatabaseSection
        dashboard={dashboard}
        isLoading={isDashboardLoading}
        hasError={dashboardHasError}
        onRetry={onDashboardRetry}
      />
      <PlausibleSection
        snapshot={plausibleSnapshot}
        isLoading={isPlausibleLoading}
        isRefreshing={isPlausibleRefreshing}
        refreshFailed={plausibleRefreshFailed}
        onRefresh={onPlausibleRefresh}
      />
    </AdminPageFrame>
  )
}
