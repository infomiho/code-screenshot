import { beforeEach, describe, expect, it, vi } from 'vitest'
import { swissPosterDocument } from '../../src/ambient/rendering/themes/swiss-poster'

const database = vi.hoisted(() => ({
  ambientAgentSession: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  transaction: vi.fn(),
}))
const changeStream = vi.hoisted(() => ({ publishAmbientChange: vi.fn() }))

vi.mock('wasp/server', () => ({
  config: { frontendUrl: 'http://localhost:3000/' },
  env: { WASP_SERVER_URL: 'http://localhost:3001/' },
  prisma: {
    ambientAgentSession: database.ambientAgentSession,
    $transaction: database.transaction,
  },
}))
vi.mock('../../src/ambient/management/ambient-change-stream', () => changeStream)

import { agentDraftRoute } from '../../src/ambient/management/agent/agent-api'

const document = JSON.parse(JSON.stringify(swissPosterDocument))
const capability = 'capability-secret-32-characters-long'

const createSession = (expiresAt = new Date(Date.now() + 60_000)) => ({
  id: 'session-1',
  ambientId: 'ambient-1',
  generation: 0,
  expiresAt,
  ambient: {
    id: 'ambient-1',
    name: 'Signal study',
    agentSessionGeneration: 0,
    draft: { revision: 1, document },
  },
})

const createResponse = () => {
  const response = {
    set: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
    type: vi.fn(),
    send: vi.fn(),
  }
  response.status.mockReturnValue(response)
  response.type.mockReturnValue(response)
  return response
}

const createTransactionClient = (overrides: {
  sessionCount?: number
  draftCount?: number
  currentRevision?: number
} = {}) => {
  const client = {
    ambientAgentSession: {
      updateMany: vi.fn().mockResolvedValue({ count: overrides.sessionCount ?? 1 }),
    },
    ambientDraft: {
      updateMany: vi.fn().mockResolvedValue({ count: overrides.draftCount ?? 1 }),
      findUnique: vi.fn().mockResolvedValue(
        overrides.currentRevision === undefined ? null : { revision: overrides.currentRevision },
      ),
    },
    ambient: {
      update: vi.fn().mockResolvedValue({}),
    },
  }
  database.transaction.mockImplementation(async (run) => run(client))
  return client
}

const callDraftRoute = (
  response: ReturnType<typeof createResponse>,
  method: string,
  body?: unknown,
) => agentDraftRoute(
  { params: { capability }, method, body } as never,
  response as never,
  {} as never,
)

beforeEach(() => {
  vi.clearAllMocks()
  database.ambientAgentSession.findUnique.mockResolvedValue(createSession())
})

describe('capability lookup binding', () => {
  it('looks up only the capability hash and rejects expired sessions', async () => {
    database.ambientAgentSession.findUnique.mockResolvedValue(createSession(new Date(Date.now() - 1)))
    const response = createResponse()

    await callDraftRoute(response, 'GET')

    const lookup = database.ambientAgentSession.findUnique.mock.calls[0][0]
    expect(lookup.where.capabilityHash).not.toBe(capability)
    expect(lookup.where.capabilityHash).toMatch(/^[a-f0-9]{64}$/)
    expect(response.status).toHaveBeenCalledWith(410)
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'agent_session_expired',
    }))
    expect(changeStream.publishAmbientChange).not.toHaveBeenCalled()
  })

  it('stamps lastUsedAt when the draft is read', async () => {
    database.ambientAgentSession.update.mockResolvedValue({})
    const response = createResponse()

    await callDraftRoute(response, 'GET')

    expect(database.ambientAgentSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { lastUsedAt: expect.any(Date) },
    })
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      workId: 'ambient-1',
      name: 'Signal study',
      revision: 1,
      previewUrl: `http://localhost:3000/agent-preview/${capability}`,
    }))
  })
})

describe('commit transaction binding', () => {
  it('re-verifies the session inside the write and touches lastUsedAt', async () => {
    const client = createTransactionClient()
    const response = createResponse()

    await callDraftRoute(response, 'PUT', { baseRevision: 1, document })

    expect(client.ambientAgentSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'session-1',
        generation: 0,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { lastUsedAt: expect.any(Date) },
    })
  })

  it('compare-and-swaps the draft on baseRevision with agent attribution', async () => {
    const client = createTransactionClient()
    const response = createResponse()

    await callDraftRoute(response, 'PUT', { baseRevision: 1, document })

    expect(client.ambientDraft.updateMany).toHaveBeenCalledWith({
      where: { ambientId: 'ambient-1', revision: 1 },
      data: {
        revision: 2,
        schemaVersion: document.schemaVersion,
        document: expect.any(Object),
        updatedBy: 'agent:session-1',
      },
    })
    expect(response.json).toHaveBeenCalledWith({
      revision: 2,
      previewUrl: `http://localhost:3000/agent-preview/${capability}`,
    })
    expect(changeStream.publishAmbientChange).toHaveBeenCalledWith({
      ambientId: 'ambient-1',
    })
  })

  it('mirrors the accepted document name onto the ambient', async () => {
    const client = createTransactionClient()
    const response = createResponse()

    await callDraftRoute(response, 'PUT', { baseRevision: 1, document })

    expect(client.ambient.update).toHaveBeenCalledWith({
      where: { id: 'ambient-1' },
      data: { name: document.name },
    })
  })

  it('reports the current revision when the CAS loses a race', async () => {
    const client = createTransactionClient({ draftCount: 0, currentRevision: 2 })
    const response = createResponse()

    await callDraftRoute(response, 'PUT', { baseRevision: 1, document })

    expect(client.ambientDraft.findUnique).toHaveBeenCalledWith({
      where: { ambientId: 'ambient-1' },
      select: { revision: true },
    })
    expect(client.ambient.update).not.toHaveBeenCalled()
    expect(response.status).toHaveBeenCalledWith(409)
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'draft_revision_conflict',
      currentRevision: 2,
    }))
    expect(changeStream.publishAmbientChange).not.toHaveBeenCalled()
  })

  it('expires the session when the in-write check finds it revoked', async () => {
    const client = createTransactionClient({ sessionCount: 0 })
    const response = createResponse()

    await callDraftRoute(response, 'PATCH', { baseRevision: 1, patch: { name: 'Renamed' } })

    expect(client.ambientDraft.updateMany).not.toHaveBeenCalled()
    expect(response.status).toHaveBeenCalledWith(410)
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'agent_session_expired',
    }))
    expect(changeStream.publishAmbientChange).not.toHaveBeenCalled()
  })

  it('rejects an envelope with unknown keys before any transaction', async () => {
    const response = createResponse()

    await callDraftRoute(response, 'PUT', { baseRevision: 1, document, documents: true })

    expect(response.status).toHaveBeenCalledWith(400)
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'invalid_request',
    }))
    expect(database.transaction).not.toHaveBeenCalled()
  })

  it('rejects a non-object patch before any transaction', async () => {
    const response = createResponse()

    await callDraftRoute(response, 'PATCH', { baseRevision: 1, patch: [] })

    expect(response.status).toHaveBeenCalledWith(400)
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'invalid_request',
    }))
    expect(database.transaction).not.toHaveBeenCalled()
  })

  it('rejects invalid documents before any transaction', async () => {
    const response = createResponse()

    await callDraftRoute(response, 'PUT', { baseRevision: 1, document: { schemaVersion: 1 } })

    expect(response.status).toHaveBeenCalledWith(422)
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'document_invalid',
      diagnostics: expect.any(Array),
    }))
    expect(database.transaction).not.toHaveBeenCalled()
  })

  it('stores a prototype-clean document', async () => {
    const client = createTransactionClient()
    const response = createResponse()
    const patch = JSON.parse('{"__proto__": {"polluted": true}, "name": "Renamed"}')

    await callDraftRoute(response, 'PATCH', { baseRevision: 1, patch })

    expect(Object.prototype).not.toHaveProperty('polluted')
    const written = client.ambientDraft.updateMany.mock.calls[0][0].data.document
    expect(Object.getPrototypeOf(written)).toBe(Object.prototype)
    expect(written.polluted).toBeUndefined()
    expect(written.name).toBe('Renamed')
  })
})
