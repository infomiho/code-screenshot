import { useEffect, useState } from 'react'
import { getMe, githubSignInUrl, logout } from 'wasp/client/auth'
import {
  createAgentAccess as createAgentAccessOperation,
  createAmbient as createAmbientOperation,
  createDraftFromVersion as createDraftFromVersionOperation,
  deleteAmbient as deleteAmbientOperation,
  discardAgentAccess as discardAgentAccessOperation,
  discardAmbientDraft as discardAmbientDraftOperation,
  getAmbientWorkspace,
  listOwnedAmbients,
  saveAmbientVersion as saveAmbientVersionOperation,
  setAmbientLinkSharing as setAmbientLinkSharingOperation,
  useQuery,
} from 'wasp/client/operations'
import { cacheAgentSession, clearAgentSessions, readAgentSession } from './agent/agent-session-cache'
import type {
  AmbientWorkspaceService,
  AmbientWorkspaceSnapshot,
  OpenAmbientWorkspace,
  SavedAmbientRecord,
} from './ambient-workspace-service'
import type { AmbientWorkspaceDto } from './contracts'
import type { AmbientLinkSharingDto } from './contracts'
import { startAmbientDraftSync } from './ambient-draft-sync'

export type WorkspaceLoadState = 'loading' | 'setup' | 'ready' | 'not-found' | 'error'

const signedOutSnapshot: AmbientWorkspaceSnapshot = {
  isHydrated: true,
  libraryStatus: 'ready',
  account: { kind: 'signed-out' },
  ownedAmbients: [],
  workspace: null,
}

const getStatusCode = (error: unknown) => {
  if (!error || typeof error !== 'object' || !('statusCode' in error)) return null
  return typeof error.statusCode === 'number' ? error.statusCode : null
}

const getConnectivity = (error: unknown): OpenAmbientWorkspace['connectivity'] => {
  if (!error) return 'online'
  return getStatusCode(error) === null ? 'offline' : 'request-error'
}

export const useHostedAmbientWorkspace = (ambientId: string | undefined, enabled: boolean) => {
  const isWorkspaceRoute = Boolean(ambientId && ambientId !== 'new')
  const authQuery = useQuery(getMe, undefined, { enabled, retry: false })
  const libraryQuery = useQuery(listOwnedAmbients, undefined, {
    enabled: enabled && Boolean(authQuery.data),
  })
  const workspaceQuery = useQuery(
    getAmbientWorkspace,
    { ambientId: isWorkspaceRoute ? ambientId! : '' },
    { enabled: enabled && Boolean(authQuery.data) && isWorkspaceRoute, retry: false },
  )
  const [mutation, setMutation] = useState<OpenAmbientWorkspace['mutation']>('idle')
  const [promptCopiedFor, setPromptCopiedFor] = useState<string | null>(null)
  const [linkSharingOverride, setLinkSharingOverride] = useState<{
    ambientId: string
    value: AmbientLinkSharingDto
  } | null>(null)
  const [, setSessionRevision] = useState(0)

  const workspaceDto = workspaceQuery.data as AmbientWorkspaceDto | undefined
  const cachedSession = workspaceDto ? readAgentSession(workspaceDto.ambient.id) : null
  const sessionMatches = Boolean(
    cachedSession
    && workspaceDto?.agentAccess.status === 'available'
    && cachedSession.generation === workspaceDto.agentAccess.generation,
  )
  const workspace: OpenAmbientWorkspace | null = workspaceDto ? {
    ...workspaceDto,
    ambient: {
      ...workspaceDto.ambient,
      linkSharing: linkSharingOverride?.ambientId === workspaceDto.ambient.id
        ? linkSharingOverride.value
        : workspaceDto.ambient.linkSharing,
    },
    agentAccessUrl: sessionMatches ? cachedSession!.url : null,
    promptCopied: promptCopiedFor === workspaceDto.ambient.id,
    connectivity: getConnectivity(workspaceQuery.error),
    mutation,
  } : null

  const user = authQuery.data
  const isHydrated = !enabled || !authQuery.isLoading
  const libraryStatus: AmbientWorkspaceSnapshot['libraryStatus'] = libraryQuery.isLoading
    ? 'loading'
    : libraryQuery.error
      ? getStatusCode(libraryQuery.error) === null ? 'offline' : 'request-error'
      : 'ready'
  const snapshot: AmbientWorkspaceSnapshot = !enabled || !user ? {
    ...signedOutSnapshot,
    isHydrated,
    libraryStatus: isHydrated ? 'ready' : 'loading',
  } : {
    isHydrated: isHydrated && !libraryQuery.isLoading,
    libraryStatus,
    account: {
      kind: 'signed-in',
      username: user.githubLogin,
      avatarUrl: user.githubAvatarUrl ?? null,
      isAdmin: libraryQuery.data?.account.kind === 'signed-in' && libraryQuery.data.account.isAdmin,
    },
    ownedAmbients: libraryQuery.data?.ownedAmbients ?? [],
    workspace,
  }

  const workspaceLoadState: WorkspaceLoadState = ambientId === 'new'
    ? 'setup'
    : !isWorkspaceRoute || workspaceQuery.error
      ? getStatusCode(workspaceQuery.error) === 404 ? 'not-found' : 'error'
      : workspaceQuery.isLoading || !workspace
        ? 'loading'
        : 'ready'

  useEffect(() => {
    setMutation('idle')
    setPromptCopiedFor(null)
    setLinkSharingOverride(null)
  }, [ambientId])

  useEffect(() => {
    if (!enabled || !workspace || workspace.agentAccess.status !== 'available') return
    return startAmbientDraftSync({
      ambientId: workspace.ambient.id,
      syncDraft: async () => {
        const result = await workspaceQuery.refetch({ throwOnError: true })
        if (result.error) throw result.error
      },
    })
  }, [enabled, workspace?.ambient.id, workspace?.agentAccess.status, workspace?.agentAccess.status === 'available' ? workspace.agentAccess.generation : null])

  useEffect(() => {
    if (!enabled || !workspace || workspace.agentAccess.status !== 'available') return
    const delay = Math.max(0, new Date(workspace.agentAccess.expiresAt).getTime() - Date.now())
    const timer = setTimeout(() => void workspaceQuery.refetch(), delay)
    return () => clearTimeout(timer)
  }, [enabled, workspace?.ambient.id, workspace?.agentAccess.status, workspace?.agentAccess.status === 'available' ? workspace.agentAccess.expiresAt : null])

  const currentAmbientId = () => workspace?.ambient.id ?? null
  const service: AmbientWorkspaceService = {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => signedOutSnapshot,
    subscribe: () => () => undefined,
    signIn: () => globalThis.location.assign(githubSignInUrl),
    signOut: async () => {
      clearAgentSessions()
      try {
        await logout()
      } catch {
        // Wasp clears local authentication and query data even if logout fails.
      }
    },
    refreshLibrary: async () => {
      await libraryQuery.refetch()
    },
    openWorkspace: async (requestedAmbientId) => {
      if (requestedAmbientId !== ambientId) return false
      const result = await workspaceQuery.refetch()
      if (result.error && getStatusCode(result.error) !== 404) throw result.error
      return Boolean(result.data)
    },
    closeWorkspace: () => undefined,
    createAmbient: async (name) => {
      if (!user) return null
      try {
        return (await createAmbientOperation({ name })).ambientId
      } catch {
        return null
      }
    },
    createAgentAccess: async (requestedAmbientId?: string) => {
      const targetAmbientId = requestedAmbientId ?? currentAmbientId()
      if (!targetAmbientId || mutation !== 'idle') return false
      setMutation('creating-access')
      try {
        const session = await createAgentAccessOperation({ ambientId: targetAmbientId })
        const cached = cacheAgentSession(session, targetAmbientId)
        setSessionRevision((revision) => revision + 1)
        setPromptCopiedFor(null)
        return cached
      } catch {
        return false
      } finally {
        setMutation('idle')
      }
    },
    discardAgentAccess: async () => {
      const targetAmbientId = currentAmbientId()
      if (!targetAmbientId) return false
      try {
        await discardAgentAccessOperation({ ambientId: targetAmbientId })
        cacheAgentSession(null, targetAmbientId)
        setSessionRevision((revision) => revision + 1)
        setPromptCopiedFor(null)
        return true
      } catch {
        return false
      }
    },
    copyPrompt: () => {
      if (workspace?.agentAccessUrl) setPromptCopiedFor(workspace.ambient.id)
    },
    saveAmbientVersion: async () => {
      if (!workspace?.workingDraft || mutation !== 'idle') return null
      setMutation('saving')
      try {
        return await saveAmbientVersionOperation({
          ambientId: workspace.ambient.id,
          draftRevision: workspace.workingDraft.revision,
        }) as SavedAmbientRecord
      } catch {
        return null
      } finally {
        setMutation('idle')
      }
    },
    discardAmbientDraft: async () => {
      const targetAmbientId = currentAmbientId()
      if (!targetAmbientId || mutation !== 'idle') return false
      setMutation('discarding')
      try {
        await discardAmbientDraftOperation({ ambientId: targetAmbientId })
        cacheAgentSession(null, targetAmbientId)
        setSessionRevision((revision) => revision + 1)
        return true
      } catch {
        return false
      } finally {
        setMutation('idle')
      }
    },
    createDraftFromVersion: async (versionId) => {
      const targetAmbientId = currentAmbientId()
      if (!targetAmbientId || mutation !== 'idle') return false
      setMutation('restoring')
      try {
        await createDraftFromVersionOperation({ ambientId: targetAmbientId, versionId })
        cacheAgentSession(null, targetAmbientId)
        setSessionRevision((revision) => revision + 1)
        setPromptCopiedFor(null)
        return true
      } catch {
        return false
      } finally {
        setMutation('idle')
      }
    },
    deleteAmbient: async (targetAmbientId) => {
      if (!user) return false
      try {
        await deleteAmbientOperation({ ambientId: targetAmbientId })
        cacheAgentSession(null, targetAmbientId)
        setSessionRevision((revision) => revision + 1)
        return true
      } catch {
        return false
      }
    },
    setLinkSharing: async (enabled) => {
      const targetAmbientId = currentAmbientId()
      if (!targetAmbientId || mutation !== 'idle') return false
      try {
        const value = await setAmbientLinkSharingOperation({ ambientId: targetAmbientId, enabled })
        setLinkSharingOverride({ ambientId: targetAmbientId, value })
        const [workspaceRefresh] = await Promise.allSettled([
          workspaceQuery.refetch(),
          libraryQuery.refetch(),
        ])
        if (workspaceRefresh.status === 'fulfilled' && !workspaceRefresh.value.error) {
          setLinkSharingOverride(null)
        }
        return true
      } catch {
        return false
      }
    },
  }

  return { service, snapshot, workspaceLoadState }
}
