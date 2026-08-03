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

import {
  agentWorkRoute,
  getAgentDocs,
  getAgentSession,
} from '../../src/ambient/management/agent/agent-api'

const document = JSON.parse(JSON.stringify(swissPosterDocument))
const capability = 'capability-secret-32-characters-long'

const createSession = (expiresAt = new Date(Date.now() + 60_000)) => ({
  id: 'session-1',
  ambientId: 'ambient-1',
  generation: 3,
  expiresAt,
  ambient: { agentSessionGeneration: 3 },
})

const createAuthorizedSession = (options: {
  expiresAt?: Date
  ambientId?: string
  generation?: number
  currentGeneration?: number
  draft?: { revision: number; document: unknown } | null
} = {}) => ({
  ambientId: options.ambientId ?? 'ambient-1',
  generation: options.generation ?? 3,
  expiresAt: options.expiresAt ?? new Date(Date.now() + 60_000),
  ambient: {
    agentSessionGeneration: options.currentGeneration ?? 3,
    draft: options.draft === undefined ? { revision: 1, document } : options.draft,
  },
})

const createResponse = () => {
  const response = {
    set: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
    end: vi.fn(),
  }
  response.status.mockReturnValue(response)
  return response
}

const createTransactionClient = (overrides: {
  sessionCount?: number
  session?: ReturnType<typeof createAuthorizedSession> | null
  draftCount?: number
  currentRevision?: number
} = {}) => {
  const client = {
    ambientAgentSession: {
      updateMany: vi.fn().mockResolvedValue({ count: overrides.sessionCount ?? 1 }),
      findUnique: vi.fn().mockResolvedValue(
        overrides.session === undefined ? createAuthorizedSession() : overrides.session,
      ),
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

const callWorkRoute = (
  response: ReturnType<typeof createResponse>,
  method: string,
  body?: unknown,
  options: { ifMatch?: string; contentType?: string } = {},
) => agentWorkRoute(
  {
    params: { capability },
    method,
    body,
    headers: { 'if-match': options.ifMatch },
    get: (name: string) => name === 'content-type' ? options.contentType : undefined,
  } as never,
  response as never,
  {} as never,
)

const put = (response: ReturnType<typeof createResponse>, body: unknown = document, ifMatch = '"1"') =>
  callWorkRoute(response, 'PUT', body, { ifMatch, contentType: 'application/json' })

const patch = (response: ReturnType<typeof createResponse>, operations: unknown, ifMatch = '"1"') =>
  callWorkRoute(response, 'PATCH', operations, {
    ifMatch,
    contentType: 'application/json-patch+json',
  })

beforeEach(() => {
  vi.clearAllMocks()
  database.ambientAgentSession.findUnique.mockImplementation(({ where }) =>
    Promise.resolve(where.capabilityHash ? createSession() : createAuthorizedSession()))
  database.ambientAgentSession.update.mockResolvedValue({})
})

describe('capability lookup binding', () => {
  it('looks up only the capability hash and rejects expired sessions', async () => {
    database.ambientAgentSession.findUnique.mockResolvedValue(createSession(new Date(Date.now() - 1)))
    const response = createResponse()

    await callWorkRoute(response, 'GET')

    const lookup = database.ambientAgentSession.findUnique.mock.calls[0][0]
    expect(lookup.where.capabilityHash).not.toBe(capability)
    expect(lookup.where.capabilityHash).toMatch(/^[a-f0-9]{64}$/)
    expect(response.status).toHaveBeenCalledWith(410)
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'session-expired' }))
    expect(changeStream.publishAmbientChange).not.toHaveBeenCalled()
  })

  it('rejects a session from an obsolete generation', async () => {
    database.ambientAgentSession.findUnique
      .mockReset()
      .mockResolvedValueOnce(createSession())
      .mockResolvedValueOnce(createAuthorizedSession({ currentGeneration: 4 }))
    const response = createResponse()

    await callWorkRoute(response, 'GET')

    expect(response.status).toHaveBeenCalledWith(410)
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'session-revoked' }))
  })

  it('returns canonical work, assessment, preview, and ETag and touches the session', async () => {
    const response = createResponse()

    await callWorkRoute(response, 'GET')

    expect(database.ambientAgentSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { lastUsedAt: expect.any(Date) },
    })
    expect(response.set).toHaveBeenCalledWith('ETag', '"1"')
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      model: 'ambient',
      version: '1',
      documentId: 'ambient-1',
      revision: 1,
      document,
      assessment: { outcome: 'pass', diagnostics: [] },
      previewUrl: `http://localhost:3000/agent-preview/${capability}`,
    }))
  })

  it('authorizes HEAD reads without returning the work body', async () => {
    const response = createResponse()

    await callWorkRoute(response, 'HEAD')

    expect(response.status).toHaveBeenCalledWith(200)
    expect(response.set).toHaveBeenCalledWith('ETag', '"1"')
    expect(response.end).toHaveBeenCalledOnce()
    expect(response.json).not.toHaveBeenCalled()
  })

  it('rejects a capability aimed outside its ambient scope', async () => {
    database.ambientAgentSession.findUnique
      .mockReset()
      .mockResolvedValueOnce(createSession())
      .mockResolvedValueOnce(createAuthorizedSession({ ambientId: 'ambient-2' }))
    const response = createResponse()

    await callWorkRoute(response, 'GET')

    expect(response.status).toHaveBeenCalledWith(404)
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'work-not-found' }))
  })
})

describe('session and documentation handlers', () => {
  it('serves an authorized session briefing', async () => {
    const response = createResponse()

    await getAgentSession({ params: { capability } } as never, response as never, {} as never)

    expect(response.status).toHaveBeenCalledWith(200)
    expect(response.send).toHaveBeenCalledWith(expect.stringContaining(`/agent/sessions/${capability}/work`))
  })

  it('serves public model docs and rejects unknown documents', async () => {
    const found = createResponse()
    const missing = createResponse()

    await getAgentDocs({
      params: { model: 'ambient', version: '1', document: 'schema.json' },
    } as never, found as never, {} as never)
    await getAgentDocs({
      params: { model: 'ambient', version: '1', document: 'missing.md' },
    } as never, missing as never, {} as never)

    expect(found.status).toHaveBeenCalledWith(200)
    expect(found.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*')
    expect(missing.status).toHaveBeenCalledWith(404)
    expect(missing.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'docs-not-found' }))
  })
})

describe('commit transaction binding', () => {
  it('commits valid work atomically with session checks, CAS, attribution, and name mirroring', async () => {
    const client = createTransactionClient()
    const response = createResponse()

    await put(response)

    expect(client.ambientAgentSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'session-1',
        ambientId: 'ambient-1',
        generation: 3,
        expiresAt: { gt: expect.any(Date) },
        ambient: { agentSessionGeneration: 3 },
      },
      data: { lastUsedAt: expect.any(Date) },
    })
    const authorityCheck = client.ambientAgentSession.updateMany.mock.calls[0][0]
    expect(authorityCheck.data.lastUsedAt).toBe(authorityCheck.where.expiresAt.gt)
    expect(client.ambientDraft.updateMany).toHaveBeenCalledWith({
      where: { ambientId: 'ambient-1', revision: 1 },
      data: {
        revision: 2,
        schemaVersion: document.schemaVersion,
        document: expect.any(Object),
        updatedBy: 'agent:session-1',
      },
    })
    expect(client.ambient.update).toHaveBeenCalledWith({
      where: { id: 'ambient-1' },
      data: { name: document.name },
    })
    expect(response.set).toHaveBeenCalledWith('ETag', '"2"')
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      revision: 2,
      document,
      assessment: { outcome: 'pass', diagnostics: [] },
      previewUrl: `http://localhost:3000/agent-preview/${capability}`,
    }))
    expect(changeStream.publishAmbientChange).toHaveBeenCalledWith({ ambientId: 'ambient-1' })
  })

  it('publishes SSE only after the transaction commits', async () => {
    database.transaction.mockRejectedValue(new Error('transaction failed'))
    const response = createResponse()

    await expect(put(response)).rejects.toThrow('transaction failed')

    expect(changeStream.publishAmbientChange).not.toHaveBeenCalled()
    expect(response.json).not.toHaveBeenCalled()
  })

  it('requires If-Match and reports stale ETags before the transaction', async () => {
    const missing = createResponse()
    const stale = createResponse()

    await callWorkRoute(missing, 'PUT', document, { contentType: 'application/json' })
    await put(stale, document, '"0"')

    expect(missing.status).toHaveBeenCalledWith(428)
    expect(missing.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'if-match-required' }))
    expect(stale.status).toHaveBeenCalledWith(412)
    expect(stale.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'revision-conflict',
      currentRevision: 1,
    }))
    expect(database.transaction).not.toHaveBeenCalled()
  })

  it('reports the current revision when the atomic CAS loses a race', async () => {
    const client = createTransactionClient({ draftCount: 0, currentRevision: 2 })
    const response = createResponse()

    await put(response)

    expect(client.ambientDraft.findUnique).toHaveBeenCalledWith({
      where: { ambientId: 'ambient-1' },
      select: { revision: true },
    })
    expect(client.ambient.update).not.toHaveBeenCalled()
    expect(response.status).toHaveBeenCalledWith(412)
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'revision-conflict',
      currentRevision: 2,
    }))
    expect(changeStream.publishAmbientChange).not.toHaveBeenCalled()
  })

  it('rejects a session that expires or is revoked inside the transaction', async () => {
    const client = createTransactionClient({
      sessionCount: 0,
      session: createAuthorizedSession({ expiresAt: new Date(0) }),
    })
    const response = createResponse()

    await patch(response, [{ op: 'replace', path: '/name', value: 'Renamed' }])

    expect(client.ambientDraft.updateMany).not.toHaveBeenCalled()
    expect(response.status).toHaveBeenCalledWith(410)
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'session-expired' }))
    expect(changeStream.publishAmbientChange).not.toHaveBeenCalled()
  })

  it('returns session-revoked when generation changes during a commit', async () => {
    const client = createTransactionClient({
      sessionCount: 0,
      session: createAuthorizedSession({ currentGeneration: 4 }),
    })
    const response = createResponse()

    await put(response)

    expect(client.ambientDraft.updateMany).not.toHaveBeenCalled()
    expect(response.status).toHaveBeenCalledWith(410)
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'session-revoked' }))
    expect(changeStream.publishAmbientChange).not.toHaveBeenCalled()
  })

  it('requires the method-specific media type', async () => {
    const response = createResponse()

    await callWorkRoute(response, 'PATCH', [], {
      ifMatch: '"1"',
      contentType: 'application/json',
    })

    expect(response.status).toHaveBeenCalledWith(415)
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'unsupported-media-type' }))
    expect(database.transaction).not.toHaveBeenCalled()
  })

  it('rejects compiler errors as work_rejected without committing', async () => {
    const response = createResponse()
    const invalid = { ...document, template: '<main></main>' }

    await put(response, invalid)

    expect(response.status).toHaveBeenCalledWith(422)
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'work-rejected',
      assessment: expect.objectContaining({ outcome: 'fail' }),
    }))
    expect(database.transaction).not.toHaveBeenCalled()
  })

  it('rejects structurally invalid work before committing', async () => {
    const response = createResponse()

    await put(response, { schemaVersion: 1 })

    expect(response.status).toHaveBeenCalledWith(422)
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'schema-rejected',
      diagnostics: expect.any(Array),
    }))
    expect(database.transaction).not.toHaveBeenCalled()
  })

})
