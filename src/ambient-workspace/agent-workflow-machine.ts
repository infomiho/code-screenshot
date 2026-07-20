import { assign, setup } from 'xstate'

export type AgentDraftLifecycle = 'none' | 'setup' | 'handoff' | 'review' | 'saved'
export type AgentAccessState = 'notApplicable' | 'available' | 'unavailable' | 'expired'
export type AgentConnectivityState = 'online' | 'offline' | 'requestError'
export type AgentMutationState = 'idle' | 'creating' | 'openingSavedAmbient' | 'saving' | 'discarding'

type AgentWorkflowContext = {
  draftKey: string | null
  hasHydrated: boolean
}

export type AgentWorkflowEvent =
  | {
      type: 'SYNC'
      access: AgentAccessState
      connectivity: AgentConnectivityState
      draftKey: string | null
      isHydrated: boolean
      lifecycle: AgentDraftLifecycle
    }
  | { type: 'BEGIN' }
  | { type: 'OPEN' }
  | { type: 'MINIMIZE' }
  | { type: 'EXIT' }
  | { type: 'RESET' }
  | { type: 'CREATE_STARTED' }
  | { type: 'EDIT_STARTED' }
  | { type: 'SAVE_STARTED' }
  | { type: 'DISCARD_STARTED' }
  | { type: 'RENEW_STARTED' }
  | { type: 'CREATE_FINISHED' }
  | { type: 'EDIT_FINISHED' }
  | { type: 'SAVE_FINISHED' }
  | { type: 'DISCARD_FINISHED' }

const isSync = (
  event: AgentWorkflowEvent,
): event is Extract<AgentWorkflowEvent, { type: 'SYNC' }> => event.type === 'SYNC'

export const agentWorkflowMachine = setup({
  types: {
    context: {} as AgentWorkflowContext,
    events: {} as AgentWorkflowEvent,
  },
  actions: {
    syncContext: assign({
      draftKey: ({ context, event }) => isSync(event) ? event.draftKey : context.draftKey,
      hasHydrated: ({ context, event }) => (
        isSync(event) ? context.hasHydrated || event.isHydrated : context.hasHydrated
      ),
    }),
  },
}).createMachine({
  id: 'agentWorkflow',
  type: 'parallel',
  context: {
    draftKey: null,
    hasHydrated: false,
  },
  states: {
    hydration: {
      initial: 'loading',
      on: {
        SYNC: [
          { guard: ({ event }) => event.isHydrated, target: '.ready' },
          { target: '.loading' },
        ],
      },
      states: {
        loading: {},
        ready: {},
      },
    },
    lifecycle: {
      initial: 'none',
      on: {
        SYNC: [
          { guard: ({ event }) => event.lifecycle === 'setup', target: '.setup' },
          { guard: ({ event }) => event.lifecycle === 'handoff', target: '.handoff' },
          { guard: ({ event }) => event.lifecycle === 'review', target: '.review' },
          { guard: ({ event }) => event.lifecycle === 'saved', target: '.saved' },
          { target: '.none' },
        ],
      },
      states: {
        none: {},
        setup: {},
        handoff: {},
        review: {},
        saved: {},
      },
    },
    access: {
      initial: 'notApplicable',
      on: {
        SYNC: [
          { guard: ({ event }) => event.access === 'available', target: '.available' },
          { guard: ({ event }) => event.access === 'unavailable', target: '.unavailable' },
          { guard: ({ event }) => event.access === 'expired', target: '.expired' },
          { target: '.notApplicable' },
        ],
        RENEW_STARTED: '.renewing',
      },
      states: {
        notApplicable: {},
        available: {},
        unavailable: {},
        expired: {},
        renewing: {},
      },
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
      states: {
        online: {},
        offline: {},
        requestError: {},
      },
    },
    mutation: {
      initial: 'idle',
      states: {
        idle: {
          on: {
            CREATE_STARTED: 'creating',
            EDIT_STARTED: 'openingSavedAmbient',
            SAVE_STARTED: 'saving',
            DISCARD_STARTED: 'discarding',
          },
        },
        creating: { on: { CREATE_FINISHED: 'idle' } },
        openingSavedAmbient: { on: { EDIT_FINISHED: 'idle' } },
        saving: { on: { SAVE_FINISHED: 'idle' } },
        discarding: { on: { DISCARD_FINISHED: 'idle' } },
      },
    },
    presentation: {
      initial: 'hidden',
      on: {
        BEGIN: '.open',
        OPEN: '.open',
        MINIMIZE: '.minimized',
        EXIT: '.hidden',
        RESET: '.hidden',
      },
      states: {
        hidden: {
          on: {
            SYNC: [
              {
                guard: ({ event }) => event.draftKey === null,
                actions: 'syncContext',
              },
              {
                guard: ({ context, event }) => (
                  context.hasHydrated
                  && context.draftKey !== null
                  && context.draftKey !== event.draftKey
                ),
                target: 'minimized',
                actions: 'syncContext',
              },
              { actions: 'syncContext' },
            ],
          },
        },
        minimized: {
          on: {
            SYNC: [
              {
                guard: ({ event }) => event.draftKey === null,
                target: 'hidden',
                actions: 'syncContext',
              },
              { actions: 'syncContext' },
            ],
          },
        },
        open: {
          on: {
            SYNC: [
              {
                guard: ({ event }) => event.draftKey === null,
                target: 'hidden',
                actions: 'syncContext',
              },
              { actions: 'syncContext' },
            ],
          },
        },
      },
    },
  },
})
