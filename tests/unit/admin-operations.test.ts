import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('wasp/server', () => ({
  HttpError: class HttpError extends Error {
    constructor(public statusCode: number, message: string) {
      super(message)
    }
  },
}))

vi.mock('../../src/admin/admin-authorization', () => ({
  isAdmin: (user: { allowed?: boolean } | undefined) => user?.allowed === true,
  requireAdmin: (user: { allowed?: boolean } | undefined) => {
    if (!user?.allowed) throw new Error('Forbidden')
  },
}))

vi.mock('../../src/admin/plausible-stats', () => ({
  getPlausibleSnapshot: vi.fn(),
  refreshPlausibleSnapshot: vi.fn(),
}))

import {
  getAdminAccess,
  getAdminDashboard,
  getAdminPlausibleSnapshot,
  refreshAdminPlausibleSnapshot,
} from '../../src/admin/admin-operations'
import { getPlausibleSnapshot, refreshPlausibleSnapshot } from '../../src/admin/plausible-stats'

describe('admin operations', () => {
  const countUsers = vi.fn()
  const findUsers = vi.fn()
  const countAmbients = vi.fn()
  const groupAmbients = vi.fn()
  const context = {
    user: { allowed: true },
    entities: {
      User: { count: countUsers, findMany: findUsers },
      Ambient: { count: countAmbients, groupBy: groupAmbients },
    },
  }

  beforeEach(() => vi.clearAllMocks())

  it('reports whether the current user is an admin', async () => {
    await expect(getAdminAccess(undefined, context as never)).resolves.toEqual({ isAdmin: true })
    await expect(getAdminAccess(undefined, { ...context, user: undefined } as never)).resolves.toEqual({
      isAdmin: false,
    })
  })

  it('returns database totals and users with ambient counts', async () => {
    countUsers.mockResolvedValue(2)
    countAmbients.mockResolvedValue(4)
    groupAmbients.mockResolvedValue([
      { status: 'DRAFT', _count: { _all: 2 } },
      { status: 'PUBLISHED', _count: { _all: 1 } },
      { status: 'ARCHIVED', _count: { _all: 1 } },
    ])
    findUsers.mockResolvedValue([
      {
        id: 'user-1',
        githubLogin: 'octocat',
        githubAvatarUrl: null,
        _count: { ambients: 3 },
      },
    ])

    const result = await getAdminDashboard(undefined, context as never)

    expect(findUsers).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        githubLogin: true,
        githubAvatarUrl: true,
        _count: { select: { ambients: true } },
      },
    })
    expect(result).toEqual({
      userCount: 2,
      ambientCount: 4,
      ambientCountsByStatus: { draft: 2, published: 1, archived: 1 },
      users: [{ id: 'user-1', githubLogin: 'octocat', githubAvatarUrl: null, ambientCount: 3 }],
    })
  })

  it('does not query data for a denied caller', async () => {
    await expect(getAdminDashboard(undefined, { ...context, user: { allowed: false } } as never)).rejects.toThrow(
      'Forbidden',
    )
    expect(countUsers).not.toHaveBeenCalled()
  })

  it('protects both Plausible operations', async () => {
    const deniedContext = { ...context, user: { allowed: false } } as never

    await expect(getAdminPlausibleSnapshot(undefined, deniedContext)).rejects.toThrow('Forbidden')
    await expect(refreshAdminPlausibleSnapshot(undefined, deniedContext)).rejects.toThrow('Forbidden')
    expect(getPlausibleSnapshot).not.toHaveBeenCalled()
    expect(refreshPlausibleSnapshot).not.toHaveBeenCalled()
  })

  it('sanitizes Plausible failures', async () => {
    vi.mocked(getPlausibleSnapshot).mockRejectedValueOnce(new Error('Bearer secret leaked'))

    await expect(getAdminPlausibleSnapshot(undefined, context as never)).rejects.toMatchObject({
      statusCode: 502,
      message: 'Plausible stats are currently unavailable.',
    })
  })
})
