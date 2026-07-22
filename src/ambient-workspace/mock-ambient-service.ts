import type { AmbientDocument, AmbientPaletteSlot } from '../ambient-schema'
import { createMinimalDraftDocument } from './minimal-draft'
import type {
  AmbientVersion,
  AmbientWorkspaceService,
  AmbientWorkspaceSnapshot,
  CurrentAmbientVersion,
  OpenAmbientWorkspace,
  OwnedAmbientSummary,
  SavedAmbientRecord,
} from './ambient-workspace-service'

const defaultAgentUpdateDelay = 1800
const defaultSaveDelay = 650
const signedOutAccount = { kind: 'signed-out' } as const
const signedInAccount = { kind: 'signed-in', username: 'codeshot-user', avatarUrl: null } as const
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString()
const now = () => new Date().toISOString()
const createSyncToken = (
  revision: number | null,
  agentSessionGeneration = 0,
  currentVersion: number | null = null,
) => ({
  revision,
  agentSessionGeneration,
  currentVersion,
})

type MockAmbient = {
  summary: OwnedAmbientSummary
  workspace: OpenAmbientWorkspace
}

const canvasPaletteCustomization: AmbientPaletteSlot = {
  type: 'palette',
  id: 'canvas',
  label: 'Canvas',
  cssVariable: '--ambient-canvas',
  valueKind: 'color',
  defaultOptionId: 'paper',
  options: [
    { id: 'paper', label: 'Paper', value: 'oklch(0.96 0.006 250)' },
    { id: 'frost', label: 'Frost', value: 'oklch(0.9 0.03 250)' },
    { id: 'moss', label: 'Moss', value: 'oklch(0.88 0.05 150)' },
  ],
}

const applyMockAgentChange = (document: AmbientDocument, revision: number): AmbientDocument => {
  const note = `/* accepted agent change ${revision} */`
  if (document.customizations.length > 0) {
    return { ...document, stylesheet: `${document.stylesheet}\n${note}` }
  }
  return {
    ...document,
    customizations: [canvasPaletteCustomization],
    stylesheet: `${document.stylesheet}\n.draft-canvas { background: var(--ambient-canvas); }\n${note}`,
  }
}

export class MockAmbientService implements AmbientWorkspaceService {
  private snapshot: AmbientWorkspaceSnapshot = {
    isHydrated: true,
    libraryStatus: 'ready',
    account: signedOutAccount,
    ownedAmbients: [],
    workspace: null,
  }
  private ambients = new Map<string, MockAmbient>()
  private listeners = new Set<() => void>()
  private nextAmbientId = 1
  private agentUpdateTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private delays = { agentUpdate: defaultAgentUpdateDelay, save: defaultSaveDelay }) {}

  getSnapshot = () => this.snapshot
  getServerSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private update = (next: AmbientWorkspaceSnapshot) => {
    this.snapshot = next
    this.listeners.forEach((listener) => listener())
  }

  private sync = (workspace = this.snapshot.workspace) => {
    if (workspace) {
      const ambient = this.ambients.get(workspace.ambient.id)
      if (ambient) ambient.workspace = workspace
    }
    this.update({
      ...this.snapshot,
      ownedAmbients: [...this.ambients.values()].map(({ summary }) => summary),
      workspace,
    })
  }

  private updateWorkspace = (update: (workspace: OpenAmbientWorkspace) => OpenAmbientWorkspace) => {
    if (!this.snapshot.workspace) return
    this.sync(update(this.snapshot.workspace))
  }

  private cancelAgentUpdate = () => {
    if (this.agentUpdateTimer === null) return
    globalThis.clearTimeout(this.agentUpdateTimer)
    this.agentUpdateTimer = null
  }

  signIn = () => {
    this.snapshot = { ...this.snapshot, account: signedInAccount }
    this.sync()
  }
  signOut = async () => this.update({ ...this.snapshot, account: signedOutAccount, ownedAmbients: [], workspace: null })
  refreshLibrary = async () => this.sync()

  openWorkspace = async (ambientId: string) => {
    const ambient = this.ambients.get(ambientId)
    if (!ambient || this.snapshot.account.kind !== 'signed-in') return false
    this.sync(ambient.workspace)
    return true
  }

  closeWorkspace = () => {
    this.cancelAgentUpdate()
    this.sync(null)
  }

  createAmbient = async (ambientName: string) => {
    if (this.snapshot.account.kind !== 'signed-in') return null
    const id = `ambient-mock-${this.nextAmbientId++}`
    const document = createMinimalDraftDocument(ambientName)
    const workspace: OpenAmbientWorkspace = {
      ambient: { id, name: ambientName },
      syncToken: createSyncToken(0),
      workingDraft: {
        revision: 0,
        baseRevision: 0,
        sourceVersion: null,
        document,
        updatedAt: now(),
        acceptedChangeCount: 0,
      },
      versionInUse: null,
      versions: [],
      agentAccess: { status: 'not-created' },
      agentAccessUrl: null,
      promptCopied: false,
      connectivity: 'online',
      mutation: 'idle',
    }
    this.ambients.set(id, {
      workspace,
      summary: {
        id,
        name: ambientName,
        visibility: 'private',
        currentVersion: null,
        draft: { status: 'waiting', revision: 0, document, updatedAt: workspace.workingDraft!.updatedAt },
      },
    })
    this.sync(workspace)
    return id
  }

  createAgentAccess = async () => {
    if (!this.snapshot.workspace) return false
    this.updateWorkspace((workspace) => {
      const revision = Math.max(-1, ...workspace.versions.map((version) => version.draftRevision)) + 1
      const workingDraft = workspace.workingDraft ?? (workspace.versionInUse ? {
        revision,
        baseRevision: revision,
        sourceVersion: workspace.versionInUse.version,
        document: JSON.parse(JSON.stringify(workspace.versionInUse.document)),
        updatedAt: now(),
        acceptedChangeCount: 0,
      } : null)
      const previousGeneration = workspace.agentAccess.status === 'not-created'
        ? 0
        : workspace.agentAccess.generation
      const ambient = this.ambients.get(workspace.ambient.id)
      if (ambient && workingDraft) {
        ambient.summary = {
          ...ambient.summary,
          draft: {
            status: workspace.versionInUse ? 'matches-version' : 'waiting',
            revision: workingDraft.revision,
            document: workingDraft.document,
            updatedAt: workingDraft.updatedAt,
          },
        }
      }
      return {
        ...workspace,
        syncToken: createSyncToken(workingDraft?.revision ?? null, previousGeneration + 1),
        workingDraft,
        agentAccess: {
          status: 'available',
          generation: previousGeneration + 1,
          expiresAt: hoursFromNow(24),
          lastUsedAt: null,
        },
        agentAccessUrl: 'https://codeshot.dev/agent/sessions/cap_demo_7c92f',
        promptCopied: false,
      }
    })
    return true
  }

  discardAgentAccess = async () => {
    if (!this.snapshot.workspace) return false
    this.cancelAgentUpdate()
    this.updateWorkspace((workspace) => ({
      ...workspace,
      syncToken: createSyncToken(
        workspace.workingDraft?.revision ?? null,
        workspace.agentAccess.status === 'not-created' ? 0 : workspace.agentAccess.generation + 1,
      ),
      agentAccess: workspace.agentAccess.status === 'not-created'
        ? workspace.agentAccess
        : { status: 'expired', generation: workspace.agentAccess.generation, expiresAt: now() },
      agentAccessUrl: null,
      promptCopied: false,
    }))
    return true
  }

  copyPrompt = () => {
    if (!this.snapshot.workspace?.agentAccessUrl) return
    this.updateWorkspace((workspace) => ({ ...workspace, promptCopied: true }))
    this.cancelAgentUpdate()
    this.agentUpdateTimer = globalThis.setTimeout(() => {
      this.agentUpdateTimer = null
      this.receiveAgentUpdate()
    }, this.delays.agentUpdate)
  }

  private receiveAgentUpdate = () => {
    this.updateWorkspace((workspace) => {
      const draft = workspace.workingDraft
      if (!draft) return workspace
      const revision = draft.revision + 1
      const updatedAt = now()
      const document = applyMockAgentChange(draft.document, revision)
      const ambient = this.ambients.get(workspace.ambient.id)
      if (ambient) {
        ambient.summary = {
          ...ambient.summary,
          draft: { status: 'review-ready', revision, document, updatedAt },
        }
      }
      return {
        ...workspace,
        syncToken: createSyncToken(revision, workspace.syncToken.agentSessionGeneration),
        workingDraft: {
          ...draft,
          revision,
          updatedAt,
          acceptedChangeCount: revision - draft.baseRevision,
          document,
        },
      }
    })
  }

  saveAmbientVersion = async () => {
    const workspace = this.snapshot.workspace
    if (!workspace?.workingDraft || workspace.mutation !== 'idle') return null
    if (
      workspace.versionInUse
      && JSON.stringify(workspace.workingDraft.document) === JSON.stringify(workspace.versionInUse.document)
    ) return null
    const ambientId = workspace.ambient.id
    const draftRevision = workspace.workingDraft.revision
    this.updateWorkspace((current) => ({ ...current, mutation: 'saving' }))
    return new Promise<SavedAmbientRecord | null>((resolve) => {
      globalThis.setTimeout(() => {
        const ambient = this.ambients.get(ambientId)
        const current = ambient?.workspace
        if (!ambient || !current?.workingDraft || current.workingDraft.revision !== draftRevision) {
          return resolve(null)
        }
        const version: AmbientVersion = {
          id: `${current.ambient.id}-version-${current.versions.length + 1}`,
          version: current.versions.length + 1,
          draftRevision: current.workingDraft.revision,
          document: JSON.parse(JSON.stringify(current.workingDraft.document)),
          createdAt: now(),
          isInUse: true,
        }
        const record: CurrentAmbientVersion = version
        ambient.summary = {
          ...ambient.summary,
          currentVersion: record,
          draft: {
            status: 'matches-version',
            revision: current.workingDraft.revision,
            document: current.workingDraft.document,
            updatedAt: now(),
          },
        }
        const savedWorkspace: OpenAmbientWorkspace = {
          ...current,
          syncToken: createSyncToken(
            current.workingDraft.revision,
            current.syncToken.agentSessionGeneration,
            version.version,
          ),
          versionInUse: record,
          versions: [version, ...current.versions.map((item) => ({ ...item, isInUse: false }))],
          workingDraft: {
            ...current.workingDraft,
            baseRevision: current.workingDraft.revision,
            sourceVersion: version.version,
            acceptedChangeCount: 0,
          },
          mutation: 'idle',
        }
        ambient.workspace = savedWorkspace
        this.sync(this.snapshot.workspace?.ambient.id === ambientId ? savedWorkspace : this.snapshot.workspace)
        resolve(record)
      }, this.delays.save)
    })
  }

  discardAmbientDraft = async () => {
    const workspace = this.snapshot.workspace
    if (!workspace) return false
    this.cancelAgentUpdate()
    const ambient = this.ambients.get(workspace.ambient.id)
    if (!ambient) return false
    if (!workspace.versionInUse) {
      this.ambients.delete(workspace.ambient.id)
      this.sync(null)
      return true
    }
    ambient.summary = { ...ambient.summary, draft: null }
    this.sync({
      ...workspace,
      syncToken: createSyncToken(null, workspace.syncToken.agentSessionGeneration + 1),
      workingDraft: null,
      agentAccess: workspace.agentAccess.status === 'not-created'
        ? workspace.agentAccess
        : { status: 'expired', generation: workspace.agentAccess.generation, expiresAt: now() },
      agentAccessUrl: null,
      mutation: 'idle',
    })
    return true
  }

  deleteAmbient = async (ambientId: string) => {
    if (this.snapshot.account.kind !== 'signed-in' || !this.ambients.delete(ambientId)) return false
    if (this.snapshot.workspace?.ambient.id === ambientId) {
      this.cancelAgentUpdate()
      this.sync(null)
    } else {
      this.sync()
    }
    return true
  }

  createDraftFromVersion = async (versionId: string) => {
    const workspace = this.snapshot.workspace
    const version = workspace?.versions.find((candidate) => candidate.id === versionId)
    if (!workspace || !version) return false
    const maximumRevision = Math.max(
      workspace.workingDraft?.revision ?? -1,
      ...workspace.versions.map((candidate) => candidate.draftRevision),
    )
    const revision = maximumRevision + 1
    const updatedAt = now()
    const ambient = this.ambients.get(workspace.ambient.id)
    if (ambient) {
      ambient.summary = {
        ...ambient.summary,
        name: version.document.name,
        draft: {
            status: version.isInUse ? 'matches-version' : 'review-ready',
            revision,
            document: version.document,
            updatedAt,
        },
      }
    }
    this.sync({
      ...workspace,
      syncToken: createSyncToken(revision, workspace.syncToken.agentSessionGeneration + 1),
      ambient: { ...workspace.ambient, name: version.document.name },
      workingDraft: {
        revision,
        baseRevision: revision,
        sourceVersion: version.version,
        document: JSON.parse(JSON.stringify(version.document)),
        updatedAt,
        acceptedChangeCount: 0,
      },
      agentAccess: workspace.agentAccess.status === 'not-created'
        ? workspace.agentAccess
        : { status: 'expired', generation: workspace.agentAccess.generation, expiresAt: now() },
      agentAccessUrl: null,
      promptCopied: false,
      mutation: 'idle',
    })
    return true
  }
}
