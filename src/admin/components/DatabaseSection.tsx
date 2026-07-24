import type { AdminDashboardDto } from '../contracts'
import { DatabaseSectionSkeleton } from './AdminSectionSkeletons'
import { MetricCard } from './MetricCard'

const numberFormatter = new Intl.NumberFormat()

type DatabaseSectionProps = {
  dashboard?: AdminDashboardDto
  isLoading: boolean
  hasError: boolean
  onRetry: () => void
}

export function DatabaseSection({ dashboard, isLoading, hasError, onRetry }: DatabaseSectionProps) {
  return (
    <section className="admin-section" aria-labelledby="database-heading">
      <div className="admin-section-heading">
        <h2 id="database-heading">Database</h2>
      </div>
      {isLoading ? (
        <>
          <p className="sr-only" role="status">Loading database statistics</p>
          <DatabaseSectionSkeleton />
        </>
      ) : hasError || !dashboard ? (
        <div className="admin-inline-error">
          <p>Database statistics could not be loaded.</p>
          <button className="ui-button" type="button" onClick={onRetry}>Try again</button>
        </div>
      ) : (
        <>
          <div className="admin-metric-grid">
            <MetricCard label="Users" value={dashboard.userCount} />
            <MetricCard label="Ambients" value={dashboard.ambientCount} />
            <MetricCard label="Draft" value={dashboard.ambientCountsByStatus.draft} />
            <MetricCard label="Published" value={dashboard.ambientCountsByStatus.published} />
            <MetricCard label="Archived" value={dashboard.ambientCountsByStatus.archived} />
          </div>

          <div className="admin-user-panel">
            <div className="admin-subheading">
              <h3>Users</h3>
              <span>{numberFormatter.format(dashboard.users.length)} total</span>
            </div>
            {dashboard.users.length > 0 ? (
              <div className="admin-user-table-wrap">
                <table className="admin-user-table">
                  <caption className="sr-only">Users and ambient counts</caption>
                  <thead>
                    <tr>
                      <th scope="col">GitHub user</th>
                      <th scope="col">Ambients</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <span className="admin-user-avatar" aria-hidden="true">
                            {user.githubAvatarUrl
                              ? <img src={user.githubAvatarUrl} alt="" />
                              : user.githubLogin.charAt(0).toLocaleUpperCase()}
                          </span>
                          <span>@{user.githubLogin}</span>
                        </td>
                        <td>{numberFormatter.format(user.ambientCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="admin-empty-copy">No users yet.</p>
            )}
          </div>
        </>
      )}
    </section>
  )
}
