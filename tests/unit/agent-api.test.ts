import { beforeEach, describe, expect, it, vi } from 'vitest'
import { swissPosterDocument } from '../../src/swiss-poster'

const database = vi.hoisted(() => ({
  ambientAgentSession: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  ambientDraft: {
    findUnique: vi.fn(),
  },
  transaction: vi.fn(),
}))

vi.mock('wasp/server', () => ({
  config: { frontendUrl: 'http://localhost:3000/' },
  env: { WASP_SERVER_URL: 'http://localhost:3001/' },
  prisma: {
    ambientAgentSession: database.ambientAgentSession,
    ambientDraft: database.ambientDraft,
    $transaction: database.transaction,
  },
}))

import { getAgentDraft, replaceAgentDraft } from '../../src/ambient-workspace/agent-api'

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

const callGetDraft = (response: ReturnType<typeof createResponse>) =>
  getAgentDraft({ params: { capability } } as never, response as never, {} as never)

const callReplaceDraft = (
  response: ReturnType<typeof createResponse>,
  body: unknown,
) => replaceAgentDraft({ params: { capability }, body } as never, response as never, {} as never)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('agent capability API', () => {
  it('looks up only the capability hash and rejects expired sessions', async () => {
    database.ambientAgentSession.findUnique.mockResolvedValue(createSession(new Date(Date.now() - 1)))
    const response = createResponse()

    await callGetDraft(response)

    const lookup = database.ambientAgentSession.findUnique.mock.calls[0][0]
    expect(lookup.where.capabilityHash).not.toBe(capability)
    expect(lookup.where.capabilityHash).toMatch(/^[a-f0-9]{64}$/)
    expect(response.status).toHaveBeenCalledWith(410)
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'agent_session_expired',
    }))
  })

  it('rejects invalid documents without changing the draft', async () => {
    database.ambientAgentSession.findUnique.mockResolvedValue(createSession())
    const response = createResponse()

    await callReplaceDraft(response, { baseRevision: 1, document: { schemaVersion: 1 } })

    expect(response.status).toHaveBeenCalledWith(422)
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'ambient_invalid',
      diagnostics: expect.any(Array),
    }))
    expect(database.transaction).not.toHaveBeenCalled()
  })

  it('reports the current revision when an optimistic update loses a race', async () => {
    database.ambientAgentSession.findUnique.mockResolvedValue(createSession())
    database.transaction.mockImplementation(async (run) => run({
      ambientAgentSession: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      ambientDraft: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    }))
    database.ambientDraft.findUnique.mockResolvedValue({ revision: 2 })
    const response = createResponse()

    await callReplaceDraft(response, { baseRevision: 1, document })

    expect(response.status).toHaveBeenCalledWith(409)
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'draft_revision_conflict',
      currentRevision: 2,
    }))
  })

  it('atomically replaces a valid current draft', async () => {
    database.ambientAgentSession.findUnique.mockResolvedValue(createSession())
    const updateDraft = vi.fn().mockResolvedValue({ count: 1 })
    const updateAmbient = vi.fn().mockResolvedValue({})
    const updateSession = vi.fn().mockResolvedValue({ count: 1 })
    database.transaction.mockImplementation(async (run) => run({
      ambientDraft: { updateMany: updateDraft },
      ambient: { update: updateAmbient },
      ambientAgentSession: { updateMany: updateSession },
    }))
    const response = createResponse()

    await callReplaceDraft(response, { baseRevision: 1, document })

    expect(updateDraft).toHaveBeenCalledWith(expect.objectContaining({
      where: { ambientId: 'ambient-1', revision: 1 },
    }))
    expect(response.json).toHaveBeenCalledWith({
      revision: 2,
      previewUrl: `http://localhost:3001/agent/sessions/${capability}/preview`,
    })
  })
})
