import { HttpError } from 'wasp/server'
import type {
  GetAdminAccess,
  GetAdminDashboard,
  GetAdminPlausibleSnapshot,
  RefreshAdminPlausibleSnapshot,
} from 'wasp/server/operations'
import type { AdminAccessDto, AdminDashboardDto, PlausibleSnapshotDto } from './contracts'
import { isAdmin, requireAdmin } from './admin-authorization'
import { getPlausibleSnapshot, refreshPlausibleSnapshot } from './plausible-stats'

export const getAdminAccess: GetAdminAccess<void, AdminAccessDto> = async (_args, context) => ({
  isAdmin: isAdmin(context.user),
})

export const getAdminDashboard: GetAdminDashboard<void, AdminDashboardDto> = async (_args, context) => {
  requireAdmin(context.user)

  // Anonymous themes are the top of the funnel, but mixed into the totals they would swamp them.
  const ownedAmbients = { ownerId: { not: null } }
  const [userCount, ambientCount, anonymousAmbientCount, ambientStatusGroups, users] = await Promise.all([
    context.entities.User.count(),
    context.entities.Ambient.count({ where: ownedAmbients }),
    context.entities.Ambient.count({ where: { guestSessionId: { not: null } } }),
    context.entities.Ambient.groupBy({ by: ['status'], where: ownedAmbients, _count: { _all: true } }),
    context.entities.User.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        githubLogin: true,
        githubAvatarUrl: true,
        _count: { select: { ambients: true } },
      },
    }),
  ])

  const statusCounts = new Map(ambientStatusGroups.map((group) => [group.status, group._count._all]))
  return {
    userCount,
    ambientCount,
    anonymousAmbientCount,
    ambientCountsByStatus: {
      draft: statusCounts.get('DRAFT') ?? 0,
      published: statusCounts.get('PUBLISHED') ?? 0,
      archived: statusCounts.get('ARCHIVED') ?? 0,
    },
    users: users.map((user) => ({
      id: user.id,
      githubLogin: user.githubLogin,
      githubAvatarUrl: user.githubAvatarUrl,
      ambientCount: user._count.ambients,
    })),
  }
}

const loadPlausibleSnapshot = async (load: () => Promise<PlausibleSnapshotDto>) => {
  try {
    return await load()
  } catch {
    throw new HttpError(502, 'Plausible stats are currently unavailable.')
  }
}

export const getAdminPlausibleSnapshot: GetAdminPlausibleSnapshot<void, PlausibleSnapshotDto> = async (
  _args,
  context,
) => {
  requireAdmin(context.user)
  return loadPlausibleSnapshot(getPlausibleSnapshot)
}

export const refreshAdminPlausibleSnapshot: RefreshAdminPlausibleSnapshot<void, PlausibleSnapshotDto> = async (
  _args,
  context,
) => {
  requireAdmin(context.user)
  return loadPlausibleSnapshot(refreshPlausibleSnapshot)
}
