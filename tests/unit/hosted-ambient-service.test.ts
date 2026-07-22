import { beforeEach, describe, expect, it, vi } from 'vitest'
import { swissPosterDocument } from '../../src/swiss-poster'

const operations = vi.hoisted(() => ({
  createAgentAccess: vi.fn(),
  createAmbient: vi.fn(),
  createDraftFromVersion: vi.fn(),
  deleteAmbient: vi.fn(),
  discardAgentAccess: vi.fn(),
  discardAmbientDraft: vi.fn(),
  getAmbientWorkspace: vi.fn(),
  listOwnedAmbients: vi.fn(),
  saveAmbientVersion: vi.fn(),
  syncAmbientDraft: vi.fn(),
}))
const auth = vi.hoisted(() => ({ logout: vi.fn() }))
const ambientDraftSync = vi.hoisted(() => ({
  startAmbientDraftSync: vi.fn(({ syncDraft }: { syncDraft: () => Promise<void> }) => {
    void syncDraft().catch(() => undefined)
    return vi.fn()
  }),
}))

vi.mock('wasp/client/operations', () => operations)
vi.mock('wasp/client/auth', () => ({
  githubSignInUrl: 'http://localhost:3001/auth/github/login',
  logout: auth.logout,
}))
vi.mock('../../src/ambient-workspace/ambient-draft-sync', () => ambientDraftSync)

import { HostedAmbientService } from '../../src/ambient-workspace/hosted-ambient-service'

const document = JSON.parse(JSON.stringify(swissPosterDocument))
const createdAt = new Date().toISOString()
const library = {
  account: { kind: 'signed-in', username: 'octocat' },
  ownedAmbients: [{
    id: 'ambient-1',
    name: 'Signal study',
    visibility: 'private',
    currentVersion: { id: 'version-1', version: 1, draftRevision: 1, document, createdAt },
    draft: { status: 'matches-version', revision: 1, document, updatedAt: createdAt },
  }],
}
const workspace = {
  ambient: { id: 'ambient-1', name: 'Signal study' },
  syncToken: {
    revision: 1,
    agentSessionGeneration: 0,
    currentVersion: 1,
  },
  workingDraft: {
    revision: 1,
    baseRevision: 1,
    sourceVersion: 1,
    document,
    updatedAt: createdAt,
    acceptedChangeCount: 0,
  },
  versionInUse: library.ownedAmbients[0].currentVersion,
  versions: [{ ...library.ownedAmbients[0].currentVersion, isInUse: true }],
  agentAccess: { status: 'not-created' },
}

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
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: createStorage() })
  auth.logout.mockResolvedValue(undefined)
  operations.listOwnedAmbients.mockResolvedValue(library)
  operations.getAmbientWorkspace.mockResolvedValue(workspace)
  operations.syncAmbientDraft.mockResolvedValue({ kind: 'unchanged', token: workspace.syncToken })
})

describe('HostedAmbientService', () => {
  it('loads library summaries separately from a route-scoped workspace', async () => {
    const service = new HostedAmbientService()
    const unsubscribe = service.subscribe(() => {})
    await vi.waitFor(() => expect(service.getSnapshot().ownedAmbients).toHaveLength(1))
    expect(service.getSnapshot().workspace).toBeNull()

    await expect(service.openWorkspace('ambient-1')).resolves.toBe(true)

    expect(operations.getAmbientWorkspace).toHaveBeenCalledWith({ ambientId: 'ambient-1' })
    expect(service.getSnapshot().workspace?.ambient.id).toBe('ambient-1')
    unsubscribe()
  })

  it('keeps raw access URLs in browser session storage only', async () => {
    const session = {
      ambientId: 'ambient-1',
      generation: 2,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      url: 'http://localhost:3001/agent/sessions/secret',
    }
    operations.createAgentAccess.mockResolvedValue(session)
    operations.getAmbientWorkspace.mockResolvedValue({
      ...workspace,
      agentAccess: {
        status: 'available',
        generation: 2,
        expiresAt: session.expiresAt,
        lastUsedAt: null,
      },
    })
    operations.syncAmbientDraft.mockResolvedValue({
      kind: 'unchanged',
      token: { ...workspace.syncToken, agentSessionGeneration: 2 },
    })
    const service = new HostedAmbientService()
    const unsubscribe = service.subscribe(() => {})
    await vi.waitFor(() => expect(service.getSnapshot().account.kind).toBe('signed-in'))
    await service.openWorkspace('ambient-1')

    await expect(service.createAgentAccess()).resolves.toBe(true)

    expect(service.getSnapshot().workspace?.agentAccessUrl).toBe(session.url)
    expect(sessionStorage.getItem('codeshot.agent-session.ambient-1')).toContain(session.url)
    unsubscribe()
  })

  it('saves the current revision and reloads both views', async () => {
    operations.saveAmbientVersion.mockResolvedValue(workspace.versionInUse)
    const service = new HostedAmbientService()
    const unsubscribe = service.subscribe(() => {})
    await vi.waitFor(() => expect(service.getSnapshot().account.kind).toBe('signed-in'))
    await service.openWorkspace('ambient-1')

    await expect(service.saveAmbientVersion()).resolves.toMatchObject({ version: 1 })

    expect(operations.saveAmbientVersion).toHaveBeenCalledWith({ ambientId: 'ambient-1', draftRevision: 1 })
    expect(operations.listOwnedAmbients).toHaveBeenCalledTimes(2)
    unsubscribe()
  })

  it('ignores a save response after its workspace closes', async () => {
    let resolveSave: (value: typeof workspace.versionInUse) => void = () => undefined
    operations.saveAmbientVersion.mockReturnValue(new Promise((resolve) => {
      resolveSave = resolve
    }))
    const service = new HostedAmbientService()
    const unsubscribe = service.subscribe(() => {})
    await vi.waitFor(() => expect(service.getSnapshot().account.kind).toBe('signed-in'))
    await service.openWorkspace('ambient-1')

    const saving = service.saveAmbientVersion()
    service.closeWorkspace()
    resolveSave(workspace.versionInUse)

    await expect(saving).resolves.toBeNull()
    expect(service.getSnapshot().workspace).toBeNull()
    expect(operations.getAmbientWorkspace).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('ignores ambient creation after the create flow closes', async () => {
    let resolveCreation: (value: { ambientId: string }) => void = () => undefined
    operations.createAmbient.mockReturnValue(new Promise((resolve) => {
      resolveCreation = resolve
    }))
    const service = new HostedAmbientService()
    const unsubscribe = service.subscribe(() => {})
    await vi.waitFor(() => expect(service.getSnapshot().account.kind).toBe('signed-in'))

    const creating = service.createAmbient('Signal study')
    service.closeWorkspace()
    resolveCreation({ ambientId: 'ambient-new' })

    await expect(creating).resolves.toBeNull()
    expect(service.getSnapshot().workspace).toBeNull()
    expect(operations.listOwnedAmbients).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('settles hydration into an offline library state', async () => {
    operations.listOwnedAmbients.mockRejectedValue(new Error('offline'))
    const service = new HostedAmbientService()
    const unsubscribe = service.subscribe(() => {})

    await vi.waitFor(() => expect(service.getSnapshot().isHydrated).toBe(true))

    expect(service.getSnapshot().libraryStatus).toBe('offline')
    unsubscribe()
  })

  it('distinguishes missing workspaces from request failures', async () => {
    const service = new HostedAmbientService()
    const unsubscribe = service.subscribe(() => {})
    await vi.waitFor(() => expect(service.getSnapshot().libraryStatus).toBe('ready'))

    operations.getAmbientWorkspace.mockRejectedValueOnce({ statusCode: 404 })
    await expect(service.openWorkspace('missing')).resolves.toBe(false)

    operations.getAmbientWorkspace.mockRejectedValueOnce(new Error('offline'))
    await expect(service.openWorkspace('ambient-1')).rejects.toThrow('offline')
    unsubscribe()
  })

  it('clears cached agent access when restoring a version', async () => {
    sessionStorage.setItem('codeshot.agent-session.ambient-1', JSON.stringify({
      ambientId: 'ambient-1',
      generation: 2,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      url: 'http://localhost:3001/agent/sessions/secret',
    }))
    operations.createDraftFromVersion.mockResolvedValue({})
    const service = new HostedAmbientService()
    const unsubscribe = service.subscribe(() => {})
    await vi.waitFor(() => expect(service.getSnapshot().libraryStatus).toBe('ready'))
    await service.openWorkspace('ambient-1')

    await expect(service.createDraftFromVersion('version-1')).resolves.toBe(true)

    expect(sessionStorage.getItem('codeshot.agent-session.ambient-1')).toBeNull()
    unsubscribe()
  })

  it('signs out locally first and resolves only after the server logout', async () => {
    let resolveLogout: () => void = () => undefined
    auth.logout.mockReturnValue(new Promise<void>((resolve) => {
      resolveLogout = resolve
    }))
    const service = new HostedAmbientService()
    const unsubscribe = service.subscribe(() => {})
    await vi.waitFor(() => expect(service.getSnapshot().account.kind).toBe('signed-in'))

    let signedOut = false
    const signingOut = service.signOut().then(() => {
      signedOut = true
    })

    expect(service.getSnapshot().account.kind).toBe('signed-out')
    expect(signedOut).toBe(false)
    resolveLogout()
    await signingOut
    expect(signedOut).toBe(true)
    unsubscribe()
  })

  it('deletes an ambient, closing its workspace and cached access', async () => {
    sessionStorage.setItem('codeshot.agent-session.ambient-1', JSON.stringify({
      ambientId: 'ambient-1',
      generation: 2,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      url: 'http://localhost:3001/agent/sessions/secret',
    }))
    operations.deleteAmbient.mockResolvedValue(undefined)
    const service = new HostedAmbientService()
    const unsubscribe = service.subscribe(() => {})
    await vi.waitFor(() => expect(service.getSnapshot().libraryStatus).toBe('ready'))
    await service.openWorkspace('ambient-1')
    operations.listOwnedAmbients.mockResolvedValue({ ...library, ownedAmbients: [] })

    await expect(service.deleteAmbient('ambient-1')).resolves.toBe(true)

    expect(operations.deleteAmbient).toHaveBeenCalledWith({ ambientId: 'ambient-1' })
    expect(service.getSnapshot().workspace).toBeNull()
    expect(service.getSnapshot().ownedAmbients).toHaveLength(0)
    expect(sessionStorage.getItem('codeshot.agent-session.ambient-1')).toBeNull()
    unsubscribe()
  })

  it('applies a draft-only sync without reloading version history', async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString()
    const availableWorkspace = {
      ...workspace,
      syncToken: { ...workspace.syncToken, agentSessionGeneration: 2 },
      agentAccess: { status: 'available' as const, generation: 2, expiresAt, lastUsedAt: null },
    }
    const changedDocument = { ...document, name: 'Live signal study' }
    operations.getAmbientWorkspace.mockResolvedValue(availableWorkspace)
    operations.syncAmbientDraft.mockResolvedValue({
      kind: 'draft-changed',
      token: { ...availableWorkspace.syncToken, revision: 2 },
      name: 'Live signal study',
      draft: {
        ...availableWorkspace.workingDraft,
        revision: 2,
        document: changedDocument,
        acceptedChangeCount: 1,
      },
    })
    const service = new HostedAmbientService()
    const unsubscribe = service.subscribe(() => {})
    await vi.waitFor(() => expect(service.getSnapshot().account.kind).toBe('signed-in'))

    await service.openWorkspace('ambient-1')
    await vi.waitFor(() => expect(service.getSnapshot().workspace?.workingDraft?.revision).toBe(2))

    expect(service.getSnapshot().workspace?.ambient.name).toBe('Live signal study')
    expect(service.getSnapshot().ownedAmbients[0].draft?.revision).toBe(2)
    expect(operations.getAmbientWorkspace).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('ignores a pending sync failure after a foreground mutation starts', async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString()
    operations.getAmbientWorkspace.mockResolvedValue({
      ...workspace,
      agentAccess: { status: 'available', generation: 0, expiresAt, lastUsedAt: null },
    })
    let rejectSync: (error: Error) => void = () => undefined
    operations.syncAmbientDraft.mockReturnValue(new Promise((_resolve, reject) => {
      rejectSync = reject
    }))
    operations.saveAmbientVersion.mockReturnValue(new Promise(() => {}))
    const service = new HostedAmbientService()
    const unsubscribe = service.subscribe(() => {})
    await vi.waitFor(() => expect(service.getSnapshot().account.kind).toBe('signed-in'))
    await service.openWorkspace('ambient-1')

    void service.saveAmbientVersion()
    expect(service.getSnapshot().workspace?.mutation).toBe('saving')
    rejectSync(new Error('offline'))
    await Promise.resolve()
    await Promise.resolve()

    expect(service.getSnapshot().workspace?.mutation).toBe('saving')
    expect(service.getSnapshot().workspace?.connectivity).toBe('online')
    unsubscribe()
  })

  it('ignores a pending sync result after a foreground mutation starts', async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString()
    operations.getAmbientWorkspace.mockResolvedValue({
      ...workspace,
      agentAccess: { status: 'available', generation: 0, expiresAt, lastUsedAt: null },
    })
    let resolveSync: (result: unknown) => void = () => undefined
    operations.syncAmbientDraft.mockReturnValue(new Promise((resolve) => {
      resolveSync = resolve
    }))
    operations.saveAmbientVersion.mockReturnValue(new Promise(() => {}))
    const service = new HostedAmbientService()
    const unsubscribe = service.subscribe(() => {})
    await vi.waitFor(() => expect(service.getSnapshot().account.kind).toBe('signed-in'))
    await service.openWorkspace('ambient-1')
    await vi.waitFor(() => expect(operations.syncAmbientDraft).toHaveBeenCalled())

    void service.saveAmbientVersion()
    resolveSync({
      kind: 'draft-changed',
      token: { ...workspace.syncToken, revision: 2 },
      name: workspace.ambient.name,
      draft: { ...workspace.workingDraft, revision: 2, acceptedChangeCount: 1 },
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(service.getSnapshot().workspace?.mutation).toBe('saving')
    expect(service.getSnapshot().workspace?.workingDraft?.revision).toBe(1)
    unsubscribe()
  })

  it('returns a failed foreground mutation to idle', async () => {
    operations.saveAmbientVersion.mockRejectedValue(new Error('offline'))
    const service = new HostedAmbientService()
    const unsubscribe = service.subscribe(() => {})
    await vi.waitFor(() => expect(service.getSnapshot().account.kind).toBe('signed-in'))
    await service.openWorkspace('ambient-1')

    await expect(service.saveAmbientVersion()).resolves.toBeNull()

    expect(service.getSnapshot().workspace?.mutation).toBe('idle')
    expect(service.getSnapshot().workspace?.connectivity).toBe('offline')
    unsubscribe()
  })

  it('restarts synchronization when a service gains subscribers again', async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString()
    operations.getAmbientWorkspace.mockResolvedValue({
      ...workspace,
      agentAccess: { status: 'available', generation: 0, expiresAt, lastUsedAt: null },
    })
    const service = new HostedAmbientService()
    const unsubscribe = service.subscribe(() => {})
    await vi.waitFor(() => expect(service.getSnapshot().account.kind).toBe('signed-in'))
    await service.openWorkspace('ambient-1')
    await vi.waitFor(() => expect(operations.syncAmbientDraft).toHaveBeenCalled())
    unsubscribe()
    operations.syncAmbientDraft.mockClear()

    const unsubscribeAgain = service.subscribe(() => {})
    await vi.waitFor(() => expect(operations.syncAmbientDraft).toHaveBeenCalled())

    unsubscribeAgain()
  })
})
