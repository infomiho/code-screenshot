import { useLayoutEffect } from 'react'
import { useActorRef, useSelector } from '@xstate/react'
import type { AmbientWorkspaceSnapshot } from './ambient-workspace-service'
import {
  agentWorkflowMachine,
  type AgentAccessState,
  type AgentConnectivityState,
  type AgentDraftLifecycle,
  type AgentWorkflowEvent,
} from './agent-workflow-machine'

const getDraftKey = (workspace: AmbientWorkspaceSnapshot) => {
  const draft = workspace.draft
  return draft ? `${draft.id}@${draft.revision}` : null
}

const getLifecycle = (workspace: AmbientWorkspaceSnapshot): AgentDraftLifecycle =>
  workspace.draft?.phase ?? 'none'

export const getAgentAccessState = (workspace: AmbientWorkspaceSnapshot): AgentAccessState => {
  const draft = workspace.draft
  if (!draft || draft.phase === 'setup') return 'notApplicable'
  const expiry = draft.promptExpiresAt ? new Date(draft.promptExpiresAt).getTime() : null
  if (draft.notice === 'expired' || (expiry !== null && expiry <= Date.now())) return 'expired'
  return draft.agentSessionUrl ? 'available' : 'unavailable'
}

const getConnectivity = (workspace: AmbientWorkspaceSnapshot): AgentConnectivityState => {
  if (workspace.draft?.notice === 'offline') return 'offline'
  if (workspace.draft?.notice === 'request-error') return 'requestError'
  return 'online'
}

export function useAgentWorkflow(workspace: AmbientWorkspaceSnapshot) {
  const actor = useActorRef(agentWorkflowMachine)
  const snapshot = useSelector(actor, (state) => state)

  useLayoutEffect(() => {
    actor.send({
      type: 'SYNC',
      access: getAgentAccessState(workspace),
      connectivity: getConnectivity(workspace),
      draftKey: getDraftKey(workspace),
      isHydrated: workspace.isHydrated,
      lifecycle: getLifecycle(workspace),
    })
  }, [actor, workspace])

  const send = (event: AgentWorkflowEvent) => actor.send(event)
  const startMutation = (
    type: 'CREATE_STARTED' | 'EDIT_STARTED' | 'SAVE_STARTED' | 'DISCARD_STARTED',
  ) => {
    if (!actor.getSnapshot().matches({ mutation: 'idle' })) return false
    actor.send({ type })
    return true
  }

  return {
    access: snapshot.value.access,
    connectivity: snapshot.value.connectivity,
    lifecycle: snapshot.value.lifecycle,
    mutation: snapshot.value.mutation,
    presentation: snapshot.value.presentation,
    isOpen: snapshot.matches({ presentation: 'open' }),
    isVisible: !snapshot.matches({ presentation: 'hidden' }),
    send,
    startMutation,
  }
}
