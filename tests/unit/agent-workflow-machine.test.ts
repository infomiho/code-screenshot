import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'
import { agentWorkflowMachine } from '../../src/ambient-workspace/agent-workflow-machine'
import { getAgentAccessState } from '../../src/ambient-workspace/use-agent-workflow'

describe('agentWorkflowMachine', () => {
  it('hydrates an existing draft without surfacing it', () => {
    const actor = createActor(agentWorkflowMachine).start()

    actor.send({
      type: 'SYNC',
      access: 'unavailable',
      connectivity: 'online',
      draftKey: 'ambient-1@2',
      isHydrated: true,
      lifecycle: 'saved',
    })

    const snapshot = actor.getSnapshot()
    expect(snapshot.matches({ hydration: 'ready' })).toBe(true)
    expect(snapshot.matches({ lifecycle: 'saved' })).toBe(true)
    expect(snapshot.matches({ access: 'unavailable' })).toBe(true)
    expect(snapshot.matches({ presentation: 'hidden' })).toBe(true)
  })

  it('opens and renews explicitly, then resurfaces a later revision', () => {
    const actor = createActor(agentWorkflowMachine).start()
    actor.send({
      type: 'SYNC',
      access: 'unavailable',
      connectivity: 'online',
      draftKey: 'ambient-1@2',
      isHydrated: true,
      lifecycle: 'saved',
    })

    actor.send({ type: 'OPEN' })
    actor.send({ type: 'RENEW_STARTED' })
    expect(actor.getSnapshot().matches({ presentation: 'open' })).toBe(true)
    expect(actor.getSnapshot().matches({ access: 'renewing' })).toBe(true)

    actor.send({
      type: 'SYNC',
      access: 'available',
      connectivity: 'online',
      draftKey: 'ambient-1@2',
      isHydrated: true,
      lifecycle: 'saved',
    })
    actor.send({ type: 'EXIT' })
    actor.send({
      type: 'SYNC',
      access: 'available',
      connectivity: 'online',
      draftKey: 'ambient-1@3',
      isHydrated: true,
      lifecycle: 'review',
    })

    expect(actor.getSnapshot().matches({ lifecycle: 'review' })).toBe(true)
    expect(actor.getSnapshot().matches({ presentation: 'minimized' })).toBe(true)
  })

  it('makes mutations explicit', () => {
    const actor = createActor(agentWorkflowMachine).start()

    actor.send({ type: 'SAVE_STARTED' })
    expect(actor.getSnapshot().matches({ mutation: 'saving' })).toBe(true)
    actor.send({ type: 'CREATE_STARTED' })
    expect(actor.getSnapshot().matches({ mutation: 'saving' })).toBe(true)
    actor.send({ type: 'SAVE_FINISHED' })
    expect(actor.getSnapshot().matches({ mutation: 'idle' })).toBe(true)
  })

  it('represents access and request failures independently', () => {
    const actor = createActor(agentWorkflowMachine).start()
    actor.send({
      type: 'SYNC',
      access: 'unavailable',
      connectivity: 'requestError',
      draftKey: 'ambient-1@1',
      isHydrated: true,
      lifecycle: 'handoff',
    })

    expect(actor.getSnapshot().matches({ access: 'unavailable' })).toBe(true)
    expect(actor.getSnapshot().matches({ connectivity: 'requestError' })).toBe(true)
  })

  it('does not revive an expired URL after a failed renewal', () => {
    expect(getAgentAccessState({
      isHydrated: true,
      account: { kind: 'signed-in', username: 'octocat' },
      savedAmbients: [],
      draft: {
        id: 'ambient-1',
        phase: 'saved',
        notice: 'request-error',
        ambientName: 'Signal study',
        agentSessionUrl: 'https://codeshot.dev/agent/sessions/expired',
        agentSessionGeneration: 1,
        promptCopied: false,
        promptExpiresAt: new Date(Date.now() - 1_000).toISOString(),
        saveState: 'idle',
        revision: 1,
        document: null,
      },
    })).toBe('expired')
  })
})
