import { beforeEach, describe, expect, it, vi } from 'vitest'
import { swissPosterDocument } from '../../src/swiss-poster'

const operations = vi.hoisted(() => ({
  createAmbient: vi.fn(),
  createAmbientAgentSession: vi.fn(),
  discardAmbientDraft: vi.fn(),
  getAmbientDraft: vi.fn(),
  getAmbientDraftRevision: vi.fn(),
  getAmbientWorkspace: vi.fn(),
  publishAmbient: vi.fn(),
}))
const auth = vi.hoisted(() => ({
  logout: vi.fn(),
}))

vi.mock('wasp/client/operations', () => operations)
vi.mock('wasp/client/auth', () => ({
  githubSignInUrl: 'http://localhost:3001/auth/github/login',
  logout: auth.logout,
}))

import { HostedAmbientService } from '../../src/ambient-workspace/hosted-ambient-service'

const document = JSON.parse(JSON.stringify(swissPosterDocument))

const createStorage = (): Storage => {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: createStorage(),
  })
  auth.logout.mockResolvedValue(undefined)
})

describe('HostedAmbientService', () => {
  it('maps persisted workspace state without exposing an unavailable capability', async () => {
    operations.getAmbientWorkspace.mockResolvedValue({
      account: { kind: 'signed-in', username: 'octocat' },
      draft: {
        id: 'ambient-1',
        phase: 'review',
        ambientName: 'Signal study',
        promptExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        agentSessionGeneration: 0,
        revision: 1,
        document,
      },
      savedAmbients: [],
    })

    const service = new HostedAmbientService()
    const unsubscribe = service.subscribe(() => {})

    await vi.waitFor(() => expect(service.getSnapshot().account).toEqual({
      kind: 'signed-in',
      username: 'octocat',
    }))
    expect(service.getSnapshot().draft).toMatchObject({
      notice: 'unavailable',
      agentSessionUrl: null,
      promptCopied: false,
      saveState: 'idle',
    })
    unsubscribe()
  })

  it('creates, polls, and publishes an ambient through Wasp operations', async () => {
    operations.getAmbientWorkspace.mockResolvedValue({
      account: { kind: 'signed-in', username: 'octocat' },
      draft: null,
      savedAmbients: [],
    })
    const session = {
      ambientId: 'ambient-1',
      generation: 0,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      url: 'http://localhost:3001/agent/sessions/secret',
    }
    operations.createAmbient.mockResolvedValue({ ambientId: 'ambient-1', session })
    operations.createAmbientAgentSession.mockResolvedValue(session)
    operations.getAmbientDraftRevision.mockResolvedValue({
      revision: 1,
      agentSessionGeneration: 0,
    })
    operations.getAmbientDraft.mockResolvedValue({
      ambientId: 'ambient-1',
      name: 'Signal study',
      revision: 1,
      document,
    })
    operations.publishAmbient.mockResolvedValue({
      id: 'ambient-1',
      version: 1,
      draftRevision: 1,
      document,
      createdAt: new Date().toISOString(),
    })

    const service = new HostedAmbientService()
    const unsubscribe = service.subscribe(() => {})
    await vi.waitFor(() => expect(service.getSnapshot().account.kind).toBe('signed-in'))

    service.beginAmbient()
    await service.createAmbient('Signal study')
    expect(service.getSnapshot().draft).toMatchObject({
      id: 'ambient-1',
      phase: 'handoff',
      agentSessionUrl: 'http://localhost:3001/agent/sessions/secret',
    })

    service.copyPrompt()
    await vi.waitFor(() => expect(service.getSnapshot().draft).toMatchObject({
      phase: 'review',
      revision: 1,
      document,
    }))

    await expect(service.savePrivateVersion()).resolves.toMatchObject({
      id: 'ambient-1',
      version: 1,
    })
    expect(operations.publishAmbient).toHaveBeenCalledWith({
      ambientId: 'ambient-1',
      draftRevision: 1,
    })
    expect(service.getSnapshot().draft?.phase).toBe('saved')
    service.signOut()
    unsubscribe()
  })

  it('discards a workspace response that finishes after logout', async () => {
    let resolveWorkspace!: (workspace: unknown) => void
    operations.getAmbientWorkspace.mockReturnValue(new Promise((resolve) => {
      resolveWorkspace = resolve
    }))
    const service = new HostedAmbientService()
    const unsubscribe = service.subscribe(() => {})

    service.signOut()
    resolveWorkspace({
      account: { kind: 'signed-in', username: 'octocat' },
      draft: null,
      savedAmbients: [],
    })
    await Promise.resolve()

    expect(service.getSnapshot().account.kind).toBe('signed-out')
    unsubscribe()
  })

  it('allows only one agent access renewal at a time', async () => {
    operations.getAmbientWorkspace.mockResolvedValue({
      account: { kind: 'signed-in', username: 'octocat' },
      draft: {
        id: 'ambient-1',
        phase: 'handoff',
        ambientName: 'Signal study',
        promptExpiresAt: null,
        agentSessionGeneration: 0,
        revision: 0,
        document,
      },
      savedAmbients: [],
    })
    let resolveSession!: (session: unknown) => void
    operations.createAmbientAgentSession.mockReturnValue(new Promise((resolve) => {
      resolveSession = resolve
    }))
    operations.getAmbientDraftRevision.mockResolvedValue({
      revision: 0,
      agentSessionGeneration: 1,
    })
    const service = new HostedAmbientService()
    const unsubscribe = service.subscribe(() => {})
    await vi.waitFor(() => expect(service.getSnapshot().account.kind).toBe('signed-in'))

    const firstRenewal = service.renewAgentAccess()
    const secondRenewal = service.renewAgentAccess()
    expect(operations.createAmbientAgentSession).toHaveBeenCalledTimes(1)
    resolveSession({
      ambientId: 'ambient-1',
      generation: 1,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      url: 'http://localhost:3001/agent/sessions/new-secret',
    })
    await Promise.all([firstRenewal, secondRenewal])

    expect(service.getSnapshot().draft).toMatchObject({
      agentSessionGeneration: 1,
      agentSessionUrl: 'http://localhost:3001/agent/sessions/new-secret',
    })
    unsubscribe()
  })

  it('discards the active draft and clears its cached session', async () => {
    operations.getAmbientWorkspace.mockResolvedValue({
      account: { kind: 'signed-in', username: 'octocat' },
      draft: {
        id: 'ambient-1',
        phase: 'review',
        ambientName: 'Signal study',
        promptExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        agentSessionGeneration: 0,
        revision: 1,
        document,
      },
      savedAmbients: [],
    })
    operations.discardAmbientDraft.mockResolvedValue({ ambientDeleted: true })
    const service = new HostedAmbientService()
    const unsubscribe = service.subscribe(() => {})
    await vi.waitFor(() => expect(service.getSnapshot().draft?.id).toBe('ambient-1'))

    await expect(service.discardAmbientDraft()).resolves.toBe(true)

    expect(operations.discardAmbientDraft).toHaveBeenCalledWith({ ambientId: 'ambient-1' })
    expect(service.getSnapshot().draft).toBeNull()
    expect(sessionStorage.getItem('codeshot.agent-session')).toBeNull()
    unsubscribe()
  })

  it('opens a fresh agent session for a saved ambient without a draft', async () => {
    operations.getAmbientWorkspace.mockResolvedValue({
      account: { kind: 'signed-in', username: 'octocat' },
      draft: null,
      savedAmbients: [{ id: 'ambient-1', version: 1, document }],
    })
    operations.createAmbientAgentSession.mockResolvedValue({
      ambientId: 'ambient-1',
      generation: 2,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      url: 'http://localhost:3001/agent/sessions/fresh-secret',
    })
    operations.getAmbientDraft.mockResolvedValue({
      ambientId: 'ambient-1',
      name: 'Signal study',
      revision: 1,
      document,
    })
    const service = new HostedAmbientService()
    const unsubscribe = service.subscribe(() => {})
    await vi.waitFor(() => expect(service.getSnapshot().account.kind).toBe('signed-in'))

    await expect(service.editAmbient('ambient-1')).resolves.toBe(true)

    expect(service.getSnapshot().draft).toMatchObject({
      id: 'ambient-1',
      phase: 'handoff',
      agentSessionUrl: 'http://localhost:3001/agent/sessions/fresh-secret',
      revision: 1,
    })
    unsubscribe()
  })
})
