import { describe, expect, it, vi } from 'vitest'
import {
  collectAbandonedGuestWork,
  guestRetention,
  isAbandoned,
  retentionFor,
} from '../../src/ambient/management/guest-cleanup'

const now = new Date('2026-07-25T12:00:00.000Z').getTime()
const agedBy = (milliseconds: number) => new Date(now - milliseconds)

const candidate = (overrides: Partial<{
  id: string
  updatedAt: Date
  draft: { revision: number; baseRevision: number } | null
  agentSessions: number
}> = {}) => ({
  id: overrides.id ?? 'ambient-1',
  updatedAt: overrides.updatedAt ?? new Date(now),
  draft: overrides.draft === undefined ? { revision: 0, baseRevision: 0 } : overrides.draft,
  _count: { agentSessions: overrides.agentSessions ?? 0 },
})

describe('guest retention', () => {
  it('keeps an untouched theme for six hours', () => {
    expect(retentionFor(candidate())).toBe(guestRetention.untouched)
  })

  it('keeps a theme with a connected agent for a day', () => {
    expect(retentionFor(candidate({ agentSessions: 1 }))).toBe(guestRetention.agentConnected)
  })

  it('keeps a theme the agent has changed for a week', () => {
    expect(retentionFor(candidate({ draft: { revision: 4, baseRevision: 1 } })))
      .toBe(guestRetention.agentDelivered)
  })

  it('does not treat a rename as agent work', () => {
    // Renaming advances both counters, so the difference stays zero.
    expect(retentionFor(candidate({ draft: { revision: 3, baseRevision: 3 } })))
      .toBe(guestRetention.untouched)
  })

  it('never drops a theme with agent work inside its window', () => {
    const delivered = candidate({
      draft: { revision: 9, baseRevision: 1 },
      updatedAt: agedBy(guestRetention.agentConnected + 1),
    })

    expect(isAbandoned(delivered, now)).toBe(false)
  })

  it('drops an untouched theme once its window passes', () => {
    expect(isAbandoned(candidate({ updatedAt: agedBy(guestRetention.untouched + 1) }), now)).toBe(true)
    expect(isAbandoned(candidate({ updatedAt: agedBy(guestRetention.untouched - 1) }), now)).toBe(false)
  })
})

describe('collectAbandonedGuestWork', () => {
  const createContext = (candidates: ReturnType<typeof candidate>[]) => ({
    entities: {
      Ambient: {
        findMany: vi.fn().mockResolvedValue(candidates),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      GuestSession: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    },
  })

  it('only ever looks at anonymous themes', async () => {
    const context = createContext([])

    await collectAbandonedGuestWork(undefined as never, context as never)

    expect(context.entities.Ambient.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { guestSessionId: { not: null } },
    }))
  })

  it('deletes themes individually so a sibling holding work survives', async () => {
    const context = createContext([
      candidate({ id: 'abandoned', updatedAt: agedBy(guestRetention.untouched + 1) }),
      candidate({
        id: 'still-wanted',
        draft: { revision: 6, baseRevision: 1 },
        updatedAt: agedBy(guestRetention.untouched + 1),
      }),
    ])

    await collectAbandonedGuestWork(undefined as never, context as never)

    expect(context.entities.Ambient.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['abandoned'] } },
    })
  })

  it('removes a session only once nothing hangs off it', async () => {
    const context = createContext([])

    await collectAbandonedGuestWork(undefined as never, context as never)

    expect(context.entities.GuestSession.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ ambients: { none: {} } }),
    }))
  })

  it('deletes nothing when every theme is still inside its window', async () => {
    const context = createContext([candidate()])

    await collectAbandonedGuestWork(undefined as never, context as never)

    expect(context.entities.Ambient.deleteMany).not.toHaveBeenCalled()
  })
})
