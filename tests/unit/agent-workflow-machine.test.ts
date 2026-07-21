import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'
import {
  agentWorkflowMachine,
  deriveAgentAccessView,
  deriveAmbientWorkspaceView,
  deriveDraftSafetyView,
} from '../../src/ambient-workspace/agent-workflow-machine'

describe('agentWorkflowMachine', () => {
  it('tracks lifecycle, access, and connectivity independently', () => {
    const actor = createActor(agentWorkflowMachine).start()
    actor.send({
      type: 'SYNC',
      lifecycle: 'reviewReady',
      access: 'expired',
      connectivity: 'online',
    })

    expect(actor.getSnapshot().matches({ lifecycle: 'reviewReady' })).toBe(true)
    expect(actor.getSnapshot().matches({ access: 'expired' })).toBe(true)
    expect(actor.getSnapshot().matches({ connectivity: 'online' })).toBe(true)
  })

  it('makes mutations explicit without presentation state', () => {
    const actor = createActor(agentWorkflowMachine).start()
    actor.send({ type: 'SAVE_STARTED' })
    expect(actor.getSnapshot().matches({ mutation: 'saving' })).toBe(true)
    actor.send({ type: 'DISCARD_STARTED' })
    expect(actor.getSnapshot().matches({ mutation: 'saving' })).toBe(true)
    actor.send({ type: 'MUTATION_FINISHED' })
    expect(actor.getSnapshot().matches({ mutation: 'idle' })).toBe(true)
    expect(actor.getSnapshot().value).not.toHaveProperty('presentation')
  })
})

describe('workspace view derivation', () => {
  it('prioritizes connectivity and saving states', () => {
    expect(deriveAmbientWorkspaceView({
      lifecycle: 'reviewReady',
      connectivity: 'offline',
      mutation: 'saving',
    })).toEqual({ status: 'offline' })
    expect(deriveAmbientWorkspaceView({
      lifecycle: 'reviewReady',
      connectivity: 'online',
      mutation: 'saving',
    })).toEqual({ status: 'saving' })
  })

  it('derives access without coupling it to draft safety', () => {
    expect(deriveAgentAccessView({ state: 'expired', expiresAt: null })).toEqual({ status: 'expired' })
    expect(deriveDraftSafetyView({ currentVersion: 3, acceptedChangeCount: 2 })).toEqual({
      status: 'ahead-of-version',
      version: 3,
      changeCount: 2,
    })
  })

  it('distinguishes never-saved and matching drafts', () => {
    expect(deriveDraftSafetyView({ currentVersion: null, acceptedChangeCount: 0 })).toEqual({
      status: 'never-saved',
    })
    expect(deriveDraftSafetyView({ currentVersion: 2, acceptedChangeCount: 0 })).toEqual({
      status: 'matches-version',
      version: 2,
    })
  })
})
