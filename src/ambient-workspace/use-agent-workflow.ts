import { useLayoutEffect } from 'react'
import { useActorRef, useSelector } from '@xstate/react'
import type {
  AmbientWorkspaceSnapshot,
  OpenAmbientWorkspace,
} from './ambient-workspace-service'
import { documentsEqual } from './contracts'
import {
  agentWorkflowMachine,
  deriveAgentAccessView,
  deriveAmbientWorkspaceView,
  deriveDraftSafetyView,
  type AgentAccessState,
  type AgentConnectivityState,
  type AgentDraftLifecycle,
} from './agent-workflow-machine'

const getAccess = (workspace: OpenAmbientWorkspace | null): AgentAccessState => {
  if (!workspace) return 'notCreated'
  if (workspace.mutation === 'creating-access') return 'creating'
  if (workspace.agentAccess.status === 'available') {
    return new Date(workspace.agentAccess.expiresAt) > new Date() ? 'available' : 'expired'
  }
  if (workspace.agentAccess.status === 'expired') return 'expired'
  return workspace.agentAccessUrl ? 'available' : 'notCreated'
}

const getLifecycle = (workspace: OpenAmbientWorkspace | null): AgentDraftLifecycle => {
  if (!workspace?.workingDraft) return 'setup'
  if (workspace.mutation === 'saving') return 'reviewReady'
  const matchesVersionInUse = Boolean(
    workspace.versionInUse
    && documentsEqual(workspace.workingDraft.document, workspace.versionInUse.document)
  )
  if (workspace.workingDraft.acceptedChangeCount > 0 || (workspace.versionInUse && !matchesVersionInUse)) {
    return 'reviewReady'
  }
  if (matchesVersionInUse) return 'saved'
  if (workspace.promptCopied) return 'waiting'
  return workspace.agentAccess.status === 'available' ? 'promptReady' : 'setup'
}

const getConnectivity = (workspace: OpenAmbientWorkspace | null): AgentConnectivityState => {
  if (workspace?.connectivity === 'offline') return 'offline'
  if (workspace?.connectivity === 'request-error') return 'requestError'
  return 'online'
}

export function useAgentWorkflow(snapshot: AmbientWorkspaceSnapshot) {
  const workspace = snapshot.workspace
  const actor = useActorRef(agentWorkflowMachine)
  const machineSnapshot = useSelector(actor, (state) => state)
  const access = getAccess(workspace)
  const connectivity = getConnectivity(workspace)
  const lifecycle = getLifecycle(workspace)

  useLayoutEffect(() => {
    actor.send({ type: 'SYNC', access, connectivity, lifecycle })
  }, [access, actor, connectivity, lifecycle])

  const mutation = machineSnapshot.value.mutation
  return {
    access: deriveAgentAccessView({
      state: machineSnapshot.value.access as AgentAccessState,
      expiresAt: workspace?.agentAccess.status === 'available' ? workspace.agentAccess.expiresAt : null,
    }),
    draftSafety: deriveDraftSafetyView({
      currentVersion: workspace?.versionInUse?.version ?? null,
      acceptedChangeCount: workspace?.workingDraft?.acceptedChangeCount ?? 0,
      sourceVersion: workspace?.workingDraft?.sourceVersion ?? null,
      matchesCurrentVersion: Boolean(
        workspace?.workingDraft
        && workspace.versionInUse
        && documentsEqual(workspace.workingDraft.document, workspace.versionInUse.document)
      ),
    }),
    workspace: deriveAmbientWorkspaceView({
      lifecycle: machineSnapshot.value.lifecycle as AgentDraftLifecycle,
      connectivity: machineSnapshot.value.connectivity as AgentConnectivityState,
      mutation,
    }),
    send: actor.send,
  }
}
