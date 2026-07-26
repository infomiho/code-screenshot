import { useEffect, useRef, useState } from 'react'
import { getMe, githubSignInUrl, logout } from 'wasp/client/auth'
import {
  claimGuestAmbients as claimGuestAmbientsOperation,
  createAgentAccess as createAgentAccessOperation,
  createAmbient as createAmbientOperation,
  createDraftFromVersion as createDraftFromVersionOperation,
  deleteAmbient as deleteAmbientOperation,
  discardAgentAccess as discardAgentAccessOperation,
  discardAmbientDraft as discardAmbientDraftOperation,
  getAmbientWorkspace,
  listOwnedAmbients,
  renameAmbient as renameAmbientOperation,
  saveAmbientVersion as saveAmbientVersionOperation,
  setAmbientLinkSharing as setAmbientLinkSharingOperation,
  useQuery,
} from 'wasp/client/operations'
import { clearGuestToken, readGuestToken, storeGuestToken } from '../../account/guest-session'
import { cacheAgentSession, clearAgentSessions, readAgentSession } from './agent/agent-session-cache'
import type {
  AmbientWorkspaceService,
  AmbientWorkspaceSnapshot,
  OpenAmbientWorkspace,
  SavedAmbientRecord,
} from './ambient-workspace-service'
import type { AmbientWorkspaceDto, CreateAmbientResult } from './contracts'
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

// Two fast clicks would otherwise mint two anonymous sessions and strand the first theme.
let pendingAmbientCreation: Promise<CreateAmbientResult> | null = null

const createAmbientOnce = (name: string, guestToken: string | null) => {
  pendingAmbientCreation ??= createAmbientOperation(
    guestToken ? { name, guestToken } : { name },
  ).finally(() => {
    pendingAmbientCreation = null
  })
  return pendingAmbientCreation
}

export const useHostedAmbientWorkspace = (ambientId: string | undefined, enabled: boolean) => {
  const isWorkspaceRoute = Boolean(ambientId && ambientId !== 'new')
  const [guestToken, setGuestToken] = useState(readGuestToken)
  const guestTokenRef = useRef(guestToken)
  const authQuery = useQuery(getMe, undefined, { enabled, retry: false })
  const libraryQuery = useQuery(listOwnedAmbients, undefined, {
    enabled: enabled && Boolean(authQuery.data),
  })
  const canOpenWorkspace = Boolean(authQuery.data) || guestToken !== null
  const workspaceQuery = useQuery(
    getAmbientWorkspace,
    {
      ambientId: isWorkspaceRoute ? ambientId! : '',
      ...(guestToken ? { guestToken } : {}),
    },
    { enabled: enabled && canOpenWorkspace && isWorkspaceRoute, retry: false },
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
    workspace,
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
      : !canOpenWorkspace
        ? 'not-found'
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
      guestToken,
      syncDraft: async () => {
        const result = await workspaceQuery.refetch({ throwOnError: true })
        if (result.error) throw result.error
      },
    })
  }, [enabled, guestToken, workspace?.ambient.id, workspace?.agentAccess.status, workspace?.agentAccess.status === 'available' ? workspace.agentAccess.generation : null])

  useEffect(() => {
    if (!enabled || !workspace || workspace.agentAccess.status !== 'available') return
    const delay = Math.max(0, new Date(workspace.agentAccess.expiresAt).getTime() - Date.now())
    const timer = setTimeout(() => void workspaceQuery.refetch(), delay)
    return () => clearTimeout(timer)
  }, [enabled, workspace?.ambient.id, workspace?.agentAccess.status, workspace?.agentAccess.status === 'available' ? workspace.agentAccess.expiresAt : null])

  const currentAmbientId = () => workspace?.ambient.id ?? null
  const guestCredential = () => (guestTokenRef.current ? { guestToken: guestTokenRef.current } : {})
  const service: AmbientWorkspaceService = {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => signedOutSnapshot,
    subscribe: () => () => undefined,
    signIn: () => globalThis.location.assign(githubSignInUrl),
    signOut: async () => {
      clearAgentSessions()
      clearGuestToken()
      guestTokenRef.current = null
      setGuestToken(null)
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
      try {
        const created = await createAmbientOnce(name, guestToken)
        if (created.guestToken) {
          storeGuestToken(created.guestToken)
          guestTokenRef.current = created.guestToken
          setGuestToken(created.guestToken)
        }
        return created.ambientId
      } catch {
        return null
      }
    },
    renameAmbient: async (name) => {
      const targetAmbientId = currentAmbientId()
      if (!targetAmbientId) return false
      try {
        await renameAmbientOperation({ ambientId: targetAmbientId, name, ...guestCredential() })
        await workspaceQuery.refetch()
        return true
      } catch {
        return false
      }
    },
    claimGuestWork: async () => {
      if (!guestToken) return null
      try {
        const result = await claimGuestAmbientsOperation({ guestToken })
        clearGuestToken()
        guestTokenRef.current = null
        setGuestToken(null)
        await Promise.allSettled([libraryQuery.refetch(), workspaceQuery.refetch()])
        return result
      } catch {
        return null
      }
    },
    createAgentAccess: async (requestedAmbientId?: string) => {
      const targetAmbientId = requestedAmbientId ?? currentAmbientId()
      if (!targetAmbientId || mutation !== 'idle') return null
      setMutation('creating-access')
      try {
        const session = await createAgentAccessOperation({
          ambientId: targetAmbientId,
          ...guestCredential(),
        })
        cacheAgentSession(session, targetAmbientId)
        setSessionRevision((revision) => revision + 1)
        setPromptCopiedFor(null)
        return session.url
      } catch {
        return null
      } finally {
        setMutation('idle')
      }
    },
    discardAgentAccess: async () => {
      const targetAmbientId = currentAmbientId()
      if (!targetAmbientId) return false
      try {
        await discardAgentAccessOperation({ ambientId: targetAmbientId, ...guestCredential() })
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
        await discardAmbientDraftOperation({ ambientId: targetAmbientId, ...guestCredential() })
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
      try {
        await deleteAmbientOperation({ ambientId: targetAmbientId, ...guestCredential() })
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
