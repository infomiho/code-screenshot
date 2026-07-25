import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'
import {
  agentWorkflowMachine,
  deriveAgentAccessView,
  deriveAmbientWorkspaceView,
  deriveDraftSafetyView,
} from '../../src/ambient/management/agent/agent-workflow-machine'

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
    expect(deriveAgentAccessView({ state: 'expired', expiresAt: null, lastUsedAt: null }))
      .toEqual({ status: 'expired' })
    expect(deriveAgentAccessView({
      state: 'available',
      expiresAt: '2026-07-26T12:00:00.000Z',
      lastUsedAt: null,
    })).toMatchObject({ hasReadDraft: false })
    expect(deriveAgentAccessView({
      state: 'available',
      expiresAt: '2026-07-26T12:00:00.000Z',
      lastUsedAt: '2026-07-25T12:00:00.000Z',
    })).toMatchObject({ hasReadDraft: true })
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
