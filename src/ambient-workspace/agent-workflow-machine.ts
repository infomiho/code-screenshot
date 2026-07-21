import { setup } from 'xstate'

export type AgentDraftLifecycle = 'none' | 'setup' | 'promptReady' | 'waiting' | 'reviewReady' | 'saved'
export type AgentAccessState = 'notCreated' | 'creating' | 'available' | 'unavailable' | 'expired'
export type AgentConnectivityState = 'online' | 'offline' | 'requestError'
export type AgentMutationState = 'idle' | 'saving' | 'discarding' | 'restoring'

export type AmbientWorkspaceView =
  | { status: 'setup' }
  | { status: 'prompt-ready' }
  | { status: 'waiting' }
  | { status: 'review-ready' }
  | { status: 'saving' }
  | { status: 'saved' }
  | { status: 'offline' }
  | { status: 'request-error' }

export type AgentAccessView =
  | { status: 'not-created' }
  | { status: 'creating' }
  | { status: 'available'; expiresAt: string }
  | { status: 'expired' }
  | { status: 'unavailable' }

export type DraftSafetyView =
  | { status: 'never-saved' }
  | { status: 'matches-version'; version: number }
  | { status: 'ahead-of-version'; version: number; changeCount: number }
  | { status: 'different-from-version'; version: number }
  | { status: 'based-on-version'; sourceVersion: number; versionInUse: number; changeCount: number }

export type AgentWorkflowEvent =
  | {
      type: 'SYNC'
      access: AgentAccessState
      connectivity: AgentConnectivityState
      lifecycle: AgentDraftLifecycle
    }
  | { type: 'ACCESS_STARTED' }
  | { type: 'SAVE_STARTED' }
  | { type: 'DISCARD_STARTED' }
  | { type: 'RESTORE_STARTED' }
  | { type: 'MUTATION_FINISHED' }

export const deriveAmbientWorkspaceView = (input: {
  lifecycle: AgentDraftLifecycle
  connectivity: AgentConnectivityState
  mutation: AgentMutationState
}): AmbientWorkspaceView => {
  if (input.connectivity === 'offline') return { status: 'offline' }
  if (input.connectivity === 'requestError') return { status: 'request-error' }
  if (input.mutation === 'saving') return { status: 'saving' }
  switch (input.lifecycle) {
    case 'none':
    case 'setup': return { status: 'setup' }
    case 'promptReady': return { status: 'prompt-ready' }
    case 'waiting': return { status: 'waiting' }
    case 'reviewReady': return { status: 'review-ready' }
    case 'saved': return { status: 'saved' }
  }
}

export const deriveAgentAccessView = (input: {
  state: AgentAccessState
  expiresAt: string | null
}): AgentAccessView => {
  if (input.state === 'creating') return { status: 'creating' }
  if (input.state === 'available' && input.expiresAt) {
    return { status: 'available', expiresAt: input.expiresAt }
  }
  if (input.state === 'expired') return { status: 'expired' }
  if (input.state === 'unavailable') return { status: 'unavailable' }
  return { status: 'not-created' }
}

export const deriveDraftSafetyView = (input: {
  currentVersion: number | null
  acceptedChangeCount: number
  matchesCurrentVersion?: boolean
  sourceVersion?: number | null
}): DraftSafetyView => {
  if (input.currentVersion === null) return { status: 'never-saved' }
  if (input.matchesCurrentVersion ?? input.acceptedChangeCount === 0) {
    return { status: 'matches-version', version: input.currentVersion }
  }
  if (input.sourceVersion != null && input.sourceVersion !== input.currentVersion) {
    return {
      status: 'based-on-version',
      sourceVersion: input.sourceVersion,
      versionInUse: input.currentVersion,
      changeCount: input.acceptedChangeCount,
    }
  }
  if (input.acceptedChangeCount === 0) {
    return { status: 'different-from-version', version: input.currentVersion }
  }
  return {
    status: 'ahead-of-version',
    version: input.currentVersion,
    changeCount: input.acceptedChangeCount,
  }
}

export const agentWorkflowMachine = setup({
  types: { events: {} as AgentWorkflowEvent },
}).createMachine({
  id: 'agentWorkflow',
  type: 'parallel',
  states: {
    lifecycle: {
      initial: 'none',
      on: {
        SYNC: [
          { guard: ({ event }) => event.lifecycle === 'setup', target: '.setup' },
          { guard: ({ event }) => event.lifecycle === 'promptReady', target: '.promptReady' },
          { guard: ({ event }) => event.lifecycle === 'waiting', target: '.waiting' },
          { guard: ({ event }) => event.lifecycle === 'reviewReady', target: '.reviewReady' },
          { guard: ({ event }) => event.lifecycle === 'saved', target: '.saved' },
          { target: '.none' },
        ],
      },
      states: { none: {}, setup: {}, promptReady: {}, waiting: {}, reviewReady: {}, saved: {} },
    },
    access: {
      initial: 'notCreated',
      on: {
        ACCESS_STARTED: '.creating',
        SYNC: [
          { guard: ({ event }) => event.access === 'available', target: '.available' },
          { guard: ({ event }) => event.access === 'expired', target: '.expired' },
          { guard: ({ event }) => event.access === 'unavailable', target: '.unavailable' },
          { target: '.notCreated' },
        ],
      },
      states: { notCreated: {}, creating: {}, available: {}, unavailable: {}, expired: {} },
    },
    connectivity: {
      initial: 'online',
      on: {
        SYNC: [
          { guard: ({ event }) => event.connectivity === 'offline', target: '.offline' },
          { guard: ({ event }) => event.connectivity === 'requestError', target: '.requestError' },
          { target: '.online' },
        ],
      },
      states: { online: {}, offline: {}, requestError: {} },
    },
    mutation: {
      initial: 'idle',
      states: {
        idle: { on: { SAVE_STARTED: 'saving', DISCARD_STARTED: 'discarding', RESTORE_STARTED: 'restoring' } },
        saving: { on: { MUTATION_FINISHED: 'idle' } },
        discarding: { on: { MUTATION_FINISHED: 'idle' } },
        restoring: { on: { MUTATION_FINISHED: 'idle' } },
      },
    },
  },
})
