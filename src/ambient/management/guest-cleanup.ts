import type { CollectAbandonedGuestWork } from 'wasp/server/jobs'

const hours = (count: number) => count * 60 * 60 * 1000

// Every click of the landing call to action creates a theme, so most anonymous rows are curiosity
// that never became work. How long a row is kept scales with how much was invested in it.
export const guestRetention = {
  untouched: hours(6),
  agentConnected: hours(24),
  agentDelivered: hours(24 * 7),
}

// Bounds one run so a burst of abuse cannot turn the hourly job into a long-running delete.
const maximumDeletionsPerRun = 1000

type AbandonedCandidate = {
  id: string
  updatedAt: Date
  draft: { revision: number; baseRevision: number } | null
  _count: { agentSessions: number }
}

export const retentionFor = (candidate: AbandonedCandidate) => {
  const acceptedChanges = candidate.draft
    ? candidate.draft.revision - candidate.draft.baseRevision
    : 0
  if (acceptedChanges > 0) return guestRetention.agentDelivered
  return candidate._count.agentSessions > 0
    ? guestRetention.agentConnected
    : guestRetention.untouched
}

export const isAbandoned = (candidate: AbandonedCandidate, now: number) =>
  now - candidate.updatedAt.getTime() > retentionFor(candidate)

export const collectAbandonedGuestWork: CollectAbandonedGuestWork<never, void> = async (
  _args,
  context,
) => {
  const now = Date.now()
  const candidates = await context.entities.Ambient.findMany({
    where: { guestSessionId: { not: null } },
    orderBy: { updatedAt: 'asc' },
    take: maximumDeletionsPerRun,
    select: {
      id: true,
      updatedAt: true,
      draft: { select: { revision: true, baseRevision: true } },
      _count: { select: { agentSessions: true } },
    },
  })

  const abandonedIds = candidates
    .filter((candidate) => isAbandoned(candidate, now))
    .map((candidate) => candidate.id)
  if (abandonedIds.length > 0) {
    await context.entities.Ambient.deleteMany({ where: { id: { in: abandonedIds } } })
  }

  // A session is only removed once nothing hangs off it, so cleaning up one abandoned theme can
  // never cascade into a sibling that still holds work.
  const emptySessions = await context.entities.GuestSession.deleteMany({
    where: {
      ambients: { none: {} },
      createdAt: { lt: new Date(now - guestRetention.untouched) },
    },
  })

  console.info(
    `[guest-cleanup] removed ${abandonedIds.length} abandoned themes and ${emptySessions.count} empty sessions`,
  )
}
