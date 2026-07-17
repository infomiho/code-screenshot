import { swissPosterDocument } from '../swiss-poster'
import type {
  AgentDraftModel,
  AmbientWorkspaceService,
  AmbientWorkspaceSnapshot,
  SavedAmbientRecord,
} from './ambient-workspace-service'

const defaultAgentUpdateDelay = 1800
const defaultSaveDelay = 650
const signedOutAccount = { kind: 'signed-out' } as const
const signedInAccount = { kind: 'signed-in', username: 'codeshot-user' } as const

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString()

const createDraft = (id: string): AgentDraftModel => ({
  id,
  phase: 'setup',
  notice: null,
  ambientName: null,
  designDirection: '',
  promptCopied: false,
  promptExpiresAt: null,
  saveState: 'idle',
  revision: 0,
  document: null,
})

const createDraftDocument = (name: string) => ({
  ...swissPosterDocument,
  name,
})

export class MockAmbientService implements AmbientWorkspaceService {
  private snapshot: AmbientWorkspaceSnapshot = {
    account: signedOutAccount,
    draft: null,
    savedAmbients: [],
  }

  private listeners = new Set<() => void>()
  private nextAmbientId = 1
  private agentUpdateTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private delays = {
    agentUpdate: defaultAgentUpdateDelay,
    save: defaultSaveDelay,
  }) {}

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

  private updateDraft = (update: (draft: AgentDraftModel) => AgentDraftModel) => {
    if (!this.snapshot.draft) return
    this.update({
      ...this.snapshot,
      draft: update(this.snapshot.draft),
    })
  }

  private cancelAgentUpdate = () => {
    if (this.agentUpdateTimer === null) return
    globalThis.clearTimeout(this.agentUpdateTimer)
    this.agentUpdateTimer = null
  }

  signIn = () => {
    this.update({ ...this.snapshot, account: signedInAccount })
  }

  signOut = () => {
    this.update({ ...this.snapshot, account: signedOutAccount })
  }

  beginAmbient = () => {
    if (this.snapshot.account.kind !== 'signed-in') return
    this.cancelAgentUpdate()
    const id = `ambient-mock-${this.nextAmbientId}`
    this.nextAmbientId += 1
    this.update({ ...this.snapshot, draft: createDraft(id) })
  }

  createAmbient = (ambientName: string, designDirection: string) => {
    this.updateDraft((draft) => ({
      ...draft,
      phase: 'handoff',
      notice: null,
      ambientName,
      designDirection,
      promptExpiresAt: hoursFromNow(24),
    }))
  }

  copyPrompt = () => {
    const draft = this.snapshot.draft
    if (
      !draft
      || !['handoff', 'review', 'saved'].includes(draft.phase)
      || draft.notice === 'expired'
    ) return

    this.updateDraft((current) => ({ ...current, promptCopied: true }))
    this.cancelAgentUpdate()
    this.agentUpdateTimer = globalThis.setTimeout(() => {
      this.agentUpdateTimer = null
      this.receiveAgentUpdate()
    }, this.delays.agentUpdate)
  }

  private receiveAgentUpdate = () => {
    this.updateDraft((draft) => {
      if (!draft.ambientName || !['handoff', 'review', 'saved'].includes(draft.phase)) return draft
      return {
        ...draft,
        phase: 'review',
        saveState: 'idle',
        revision: draft.revision + 1,
        document: createDraftDocument(draft.ambientName),
      }
    })
  }

  renewAgentAccess = () => {
    this.updateDraft((draft) => ({
      ...draft,
      notice: null,
      promptCopied: false,
      promptExpiresAt: hoursFromNow(24),
    }))
  }

  retryConnection = () => {
    this.updateDraft((draft) => ({ ...draft, notice: null }))
  }

  savePrivateVersion = async () => {
    const draft = this.snapshot.draft
    if (!draft?.document || draft.saveState === 'saving') return null

    this.updateDraft((current) => ({ ...current, saveState: 'saving' }))
    return new Promise<SavedAmbientRecord | null>((resolve) => {
      globalThis.setTimeout(() => {
        const current = this.snapshot.draft
        if (!current?.document) {
          resolve(null)
          return
        }

        const previous = this.snapshot.savedAmbients.find((record) => record.id === current.id)
        const record: SavedAmbientRecord = {
          id: current.id,
          version: (previous?.version ?? 0) + 1,
          document: current.document,
        }
        const savedAmbients = [
          ...this.snapshot.savedAmbients.filter((candidate) => candidate.id !== record.id),
          record,
        ]

        this.update({
          ...this.snapshot,
          savedAmbients,
          draft: {
            ...current,
            phase: 'saved',
            saveState: 'idle',
          },
        })
        resolve(record)
      }, this.delays.save)
    })
  }
}
