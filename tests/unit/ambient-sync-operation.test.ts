import { beforeEach, describe, expect, it, vi } from 'vitest'
import { swissPosterDocument } from '../../src/ambient/rendering/themes/swiss-poster'

vi.mock('wasp/server', () => ({
  env: { ADMIN_GITHUB_IDS: '' },
  HttpError: class HttpError extends Error {
    constructor(public statusCode: number, message: string) {
      super(message)
    }
  },
  prisma: {},
}))

import { syncAmbientDraft } from '../../src/ambient/management/ambient-operations'

const updatedAt = new Date('2026-07-22T12:00:00.000Z')
const status = {
  agentSessionGeneration: 2,
  currentVersion: 1,
  updatedAt,
  draft: { revision: 4 },
}

describe('syncAmbientDraft', () => {
  const findFirst = vi.fn()
  const context = {
    user: { id: 'user-1' },
    entities: { Ambient: { findFirst } },
  }

  beforeEach(() => vi.clearAllMocks())

  it('returns only the changed working draft after a revision increase', async () => {
    const draftUpdatedAt = new Date('2026-07-22T12:00:01.000Z')
    findFirst
      .mockResolvedValueOnce(status)
      .mockResolvedValueOnce({
        name: 'Signal study',
        agentSessionGeneration: 2,
        currentVersion: 1,
        updatedAt,
        draft: {
          revision: 4,
          baseRevision: 3,
          sourceVersion: 1,
          document: swissPosterDocument,
          updatedAt: draftUpdatedAt,
        },
      })

    const result = await syncAmbientDraft({
      ambientId: 'ambient-1',
      knownRevision: 3,
      knownAgentSessionGeneration: 2,
      knownCurrentVersion: 1,
    }, context as never)

    expect(result).toMatchObject({
      kind: 'draft-changed',
      name: 'Signal study',
      draft: { revision: 4, acceptedChangeCount: 1 },
    })
    expect(findFirst).toHaveBeenCalledTimes(2)
  })

  it('invalidates the workspace when agent access changes', async () => {
    findFirst.mockResolvedValue(status)

    const result = await syncAmbientDraft({
      ambientId: 'ambient-1',
      knownRevision: 4,
      knownAgentSessionGeneration: 1,
      knownCurrentVersion: 1,
    }, context as never)

    expect(result.kind).toBe('workspace-invalidated')
    expect(findFirst).toHaveBeenCalledTimes(1)
  })

  it('invalidates a version change even when the draft revision also increased', async () => {
    findFirst.mockResolvedValue({ ...status, currentVersion: 2 })

    const result = await syncAmbientDraft({
      ambientId: 'ambient-1',
      knownRevision: 3,
      knownAgentSessionGeneration: 2,
      knownCurrentVersion: 1,
    }, context as never)

    expect(result.kind).toBe('workspace-invalidated')
    expect(findFirst).toHaveBeenCalledTimes(1)
  })

  it('invalidates when a version changes between status and draft reads', async () => {
    findFirst
      .mockResolvedValueOnce(status)
      .mockResolvedValueOnce({
        name: 'Signal study',
        agentSessionGeneration: 2,
        currentVersion: 2,
        updatedAt,
        draft: {
          revision: 4,
          baseRevision: 3,
          sourceVersion: 1,
          document: swissPosterDocument,
          updatedAt,
        },
      })

    const result = await syncAmbientDraft({
      ambientId: 'ambient-1',
      knownRevision: 3,
      knownAgentSessionGeneration: 2,
      knownCurrentVersion: 1,
    }, context as never)

    expect(result.kind).toBe('workspace-invalidated')
    expect(findFirst).toHaveBeenCalledTimes(2)
  })
})
