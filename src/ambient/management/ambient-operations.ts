import { randomBytes } from 'node:crypto'
import { HttpError, prisma } from 'wasp/server'
import type {
  ClaimGuestAmbients,
  CreateAgentAccess,
  CreateAmbient,
  CreateDraftFromVersion,
  DeleteAmbient,
  DiscardAgentAccess,
  DiscardAmbientDraft,
  GetAmbientWorkspace,
  GetSharedAmbient,
  ListOwnedAmbients,
  RenameAmbient,
  SaveAmbientVersion,
  SetAmbientLinkSharing,
  SyncAmbientDraft,
} from 'wasp/server/operations'
import type { ZodType } from 'zod'
import { compileAmbientDocument } from '../compiler'
import type { AmbientDocument } from '../schema'
import { createAgentSessionAccess, hashAgentCapability } from './agent/agent-session-access'
import { resolveAmbientAccess, resolveAmbientOwner } from './ambient-access'
import { hashToken } from '../../account/token-hash'
import { publishAmbientChange } from './ambient-change-stream'
import {
  ambientIdInputSchema,
  claimGuestAmbientsInputSchema,
  createAmbientInputSchema,
  createDraftFromVersionInputSchema,
  createSyncToken,
  deriveDraftStatus,
  documentsEqual,
  renameAmbientInputSchema,
  saveAmbientVersionInputSchema,
  setAmbientLinkSharingInputSchema,
  sharedAmbientInputSchema,
  syncAmbientDraftInputSchema,
} from './contracts'
import type {
  AgentSessionDto,
  AmbientIdInput,
  AmbientSyncTokenDto,
  AmbientLibraryDto,
  AmbientLinkSharingDto,
  DeleteAmbientInput,
  AmbientVersionSummaryDto,
  AmbientWorkspaceDto,
  ClaimGuestAmbientsInput,
  ClaimGuestAmbientsResult,
  CreateAgentAccessInput,
  CreateAmbientInput,
  CreateAmbientResult,
  CreateDraftFromVersionInput,
  DiscardAgentAccessInput,
  DiscardAmbientDraftInput,
  DiscardAmbientDraftResult,
  OwnedAmbientDraftSummaryDto,
  RenameAmbientInput,
  RenameAmbientResult,
  SaveAmbientVersionInput,
  SavedAmbientVersionDto,
  SetAmbientLinkSharingInput,
  SharedAmbientDto,
  SharedAmbientInput,
  SyncAmbientDraftInput,
  SyncAmbientDraftResult,
  WorkingDraftDto,
  WorkspaceDocumentDto,
  WorkspaceDraftRevisionDto,
} from './contracts'
import { createMinimalDraftDocument } from './minimal-draft'
import { isAdmin } from '../../admin/admin-authorization'

const requireUser = <T extends { id: string }>(user: T | undefined): T => {
  if (!user) throw new HttpError(401, 'Sign in with GitHub to manage themes.')
  return user
}

const parseInput = <Value>(schema: ZodType<Value>, value: unknown) => {
  const result = schema.safeParse(value)
  if (!result.success) throw new HttpError(400, 'Invalid request.')
  return result.data
}

const readDocument = (value: unknown): WorkspaceDocumentDto => {
  const result = compileAmbientDocument(value)
  if (!result.compiled) throw new HttpError(500, 'Stored theme is invalid.')
  return JSON.parse(JSON.stringify(result.compiled.document))
}

const serializeDocument = (document: AmbientDocument | WorkspaceDocumentDto): WorkspaceDocumentDto =>
  JSON.parse(JSON.stringify(document))

const slugify = (name: string) => {
  const base = name
    .toLocaleLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .slice(0, 48) || 'ambient'
  return `${base}-${randomBytes(3).toString('hex')}`
}

const toVersionDto = (version: {
  id: string
  version: number
  draftRevision: number
  document: unknown
  createdAt: Date
}): SavedAmbientVersionDto => ({
  id: version.id,
  version: version.version,
  draftRevision: version.draftRevision,
  document: readDocument(version.document),
  createdAt: version.createdAt.toISOString(),
})

const toDraftSummary = (
  draft: { revision: number; baseRevision: number; document: unknown; updatedAt: Date } | null,
  currentVersion: { document: unknown } | null,
): OwnedAmbientDraftSummaryDto | null => {
  if (!draft) return null
  const document = readDocument(draft.document)
  return {
    status: deriveDraftStatus(
      document,
      draft.revision - draft.baseRevision,
      currentVersion ? readDocument(currentVersion.document) : null,
    ),
    revision: draft.revision,
    document,
    updatedAt: draft.updatedAt.toISOString(),
  }
}

const toWorkingDraftDto = (draft: {
  revision: number
  baseRevision: number
  sourceVersion: number | null
  document: unknown
  updatedAt: Date
}): WorkingDraftDto => ({
  revision: draft.revision,
  baseRevision: draft.baseRevision,
  sourceVersion: draft.sourceVersion,
  document: readDocument(draft.document),
  updatedAt: draft.updatedAt.toISOString(),
  acceptedChangeCount: draft.revision - draft.baseRevision,
})

export const listOwnedAmbients: ListOwnedAmbients<void, AmbientLibraryDto> = async (_args, context) => {
  const user = context.user
  if (!user) return { account: { kind: 'signed-out' }, ownedAmbients: [] }

  const ambients = await context.entities.Ambient.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: 'desc' },
    include: {
      draft: true,
      versions: { orderBy: { version: 'desc' }, take: 1 },
    },
  })

  return {
    account: {
      kind: 'signed-in',
      username: user.githubLogin,
      avatarUrl: user.githubAvatarUrl ?? null,
      isAdmin: isAdmin(user),
    },
    ownedAmbients: ambients.map((ambient) => {
      const currentVersion = ambient.versions[0]
      return {
        id: ambient.id,
        name: ambient.name,
        visibility: ambient.linkSharingEnabled ? 'link' : 'private',
        currentVersion: currentVersion ? toVersionDto(currentVersion) : null,
        draft: toDraftSummary(ambient.draft, currentVersion ?? null),
      }
    }),
  }
}

export const getAmbientWorkspace: GetAmbientWorkspace<AmbientIdInput, AmbientWorkspaceDto> = async (
  args,
  context,
) => {
  const input = parseInput(ambientIdInputSchema, args)
  const access = await resolveAmbientAccess(context, input)
  const ambient = await context.entities.Ambient.findFirst({
    where: { id: input.ambientId, ...access.scope },
    include: {
      draft: true,
      versions: { orderBy: { version: 'desc' } },
      agentSessions: { orderBy: { generation: 'desc' }, take: 1 },
    },
  })
  if (!ambient) throw new HttpError(404, 'Theme not found.')

  const versions: AmbientVersionSummaryDto[] = ambient.versions.map((version) => ({
    ...toVersionDto(version),
    isInUse: version.version === ambient.currentVersion,
  }))
  const versionInUse = versions.find((version) => version.isInUse) ?? null
  const session = ambient.agentSessions[0]
  const agentAccess = !session
    ? { status: 'not-created' as const }
    : session.expiresAt > new Date() && session.generation === ambient.agentSessionGeneration
      ? {
          status: 'available' as const,
          generation: session.generation,
          expiresAt: session.expiresAt.toISOString(),
          lastUsedAt: session.lastUsedAt?.toISOString() ?? null,
        }
      : {
          status: 'expired' as const,
          generation: session.generation,
          expiresAt: session.expiresAt.toISOString(),
        }

  return {
    ambient: {
      id: ambient.id,
      name: ambient.name,
      slug: ambient.slug,
      ownership: access.kind === 'guest' ? 'guest' : 'owned',
      linkSharing: {
        enabled: ambient.linkSharingEnabled,
        shareId: ambient.shareId,
      },
    },
    syncToken: createSyncToken(
      ambient.draft?.revision ?? null,
      ambient.agentSessionGeneration,
      ambient.currentVersion,
    ),
    workingDraft: ambient.draft ? toWorkingDraftDto(ambient.draft) : null,
    versionInUse,
    versions,
    agentAccess,
  }
}

export const getSharedAmbient: GetSharedAmbient<SharedAmbientInput, SharedAmbientDto> = async (
  args,
  context,
) => {
  const { shareId } = parseInput(sharedAmbientInputSchema, args)
  const ambient = await context.entities.Ambient.findFirst({
    where: { shareId, linkSharingEnabled: true, currentVersion: { not: null } },
    select: { id: true, slug: true, currentVersion: true },
  })
  if (!ambient?.currentVersion) throw new HttpError(404, 'Shared theme not found.')

  const version = await context.entities.AmbientVersion.findUnique({
    where: { ambientId_version: { ambientId: ambient.id, version: ambient.currentVersion } },
  })
  if (!version) throw new HttpError(404, 'Shared theme not found.')

  return { id: ambient.id, slug: ambient.slug, version: toVersionDto(version) }
}

export const setAmbientLinkSharing: SetAmbientLinkSharing<
  SetAmbientLinkSharingInput,
  AmbientLinkSharingDto
> = async (args, context) => {
  const user = requireUser(context.user)
  const input = parseInput(setAmbientLinkSharingInputSchema, args)
  const ambient = await context.entities.Ambient.findFirst({
    where: { id: input.ambientId, ownerId: user.id },
    select: { id: true, currentVersion: true, shareId: true },
  })
  if (!ambient) throw new HttpError(404, 'Theme not found.')
  if (input.enabled && ambient.currentVersion === null) {
    throw new HttpError(409, 'Save a version before enabling link sharing.')
  }

  if (input.enabled && ambient.shareId === null) {
    const shareId = randomBytes(16).toString('base64url')
    const claimed = await context.entities.Ambient.updateMany({
      where: { id: ambient.id, shareId: null },
      data: { linkSharingEnabled: true, shareId },
    })
    if (claimed.count > 0) return { enabled: true, shareId }
  }

  const updated = await context.entities.Ambient.update({
    where: { id: ambient.id },
    data: { linkSharingEnabled: input.enabled },
    select: { linkSharingEnabled: true, shareId: true },
  })
  return { enabled: updated.linkSharingEnabled, shareId: updated.shareId }
}

export const createAmbient: CreateAmbient<CreateAmbientInput, CreateAmbientResult> = async (args, context) => {
  const input = parseInput(createAmbientInputSchema, args)
  const owner = await resolveAmbientOwner(context, input)
  const document = createMinimalDraftDocument(input.name)
  const ambient = await context.entities.Ambient.create({
    data: {
      ...owner.scope,
      slug: slugify(input.name),
      name: input.name,
      draft: {
        create: {
          revision: 0,
          baseRevision: 0,
          sourceVersion: null,
          schemaVersion: document.schemaVersion,
          document: serializeDocument(document),
          updatedBy: owner.actor,
        },
      },
    },
  })
  return owner.mintedGuestToken
    ? { ambientId: ambient.id, guestToken: owner.mintedGuestToken }
    : { ambientId: ambient.id }
}

export const renameAmbient: RenameAmbient<RenameAmbientInput, RenameAmbientResult> = async (
  args,
  context,
) => {
  const input = parseInput(renameAmbientInputSchema, args)
  const access = await resolveAmbientAccess(context, input)
  const revision = await prisma.$transaction(async (transaction) => {
    const ambient = await transaction.ambient.findFirst({
      where: { id: input.ambientId, ...access.scope },
      select: { id: true, draft: { select: { document: true } } },
    })
    if (!ambient) throw new HttpError(404, 'Theme not found.')

    await transaction.ambient.update({ where: { id: input.ambientId }, data: { name: input.name } })
    // With no draft there is nothing for an agent to overwrite the name from, so the row is enough.
    if (!ambient.draft) return null

    const renamed = compileAmbientDocument({ ...readDocument(ambient.draft.document), name: input.name })
    if (!renamed.compiled) throw new HttpError(500, 'Stored theme is invalid.')
    // Both counters move together. `revision - baseRevision` is the accepted agent change count, so
    // advancing revision alone would make renaming look like the agent had delivered work.
    const draft = await transaction.ambientDraft.update({
      where: { ambientId: input.ambientId },
      data: {
        revision: { increment: 1 },
        baseRevision: { increment: 1 },
        schemaVersion: renamed.compiled.document.schemaVersion,
        document: serializeDocument(renamed.compiled.document),
        updatedBy: access.actor,
      },
      select: { revision: true },
    })
    return draft.revision
  }, { isolationLevel: 'Serializable' })

  publishAmbientChange({ ambientId: input.ambientId })
  return { name: input.name, revision }
}

type ClaimCandidate = {
  id: string
  name: string
  slug: string
  draft: { revision: number } | null
  agentSessions: { lastUsedAt: Date | null }[]
}

// Claiming an untouched shell would only clutter the library. A revision past the initial one means
// a rename or an agent write; sessions exist from creation, so only a fetched one counts as contact.
const holdsGuestWork = (ambient: ClaimCandidate) =>
  (ambient.draft?.revision ?? 0) > 0
  || ambient.agentSessions.some((session) => session.lastUsedAt !== null)

// `@@unique([ownerId, slug])` never applied while the ambient was anonymous, so a slug can collide
// with one the account already owns. Picking a free slug up front keeps the claim to a single UPDATE,
// which the owner/guest CHECK constraint requires.
const nextFreeSlug = (ambient: ClaimCandidate, taken: Set<string>) => {
  let slug = ambient.slug
  while (taken.has(slug)) slug = slugify(ambient.name)
  taken.add(slug)
  return slug
}

const isWriteConflict = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034'

export const claimGuestAmbients: ClaimGuestAmbients<
  ClaimGuestAmbientsInput,
  ClaimGuestAmbientsResult
> = async (args, context) => {
  const user = requireUser(context.user)
  const { guestToken } = parseInput(claimGuestAmbientsInputSchema, args)

  const claim = () => prisma.$transaction(async (transaction) => {
    const session = await transaction.guestSession.findUnique({
      where: { tokenHash: hashToken(guestToken) },
      select: {
        id: true,
        claimedAt: true,
        ambients: {
          select: {
            id: true,
            name: true,
            slug: true,
            draft: { select: { revision: true } },
            agentSessions: { select: { lastUsedAt: true } },
          },
        },
      },
    })
    if (!session || session.claimedAt !== null) {
      return { claimedAmbientIds: [], discardedAmbientIds: [] }
    }

    const owned = await transaction.ambient.findMany({
      where: { ownerId: user.id },
      select: { slug: true },
    })
    const takenSlugs = new Set(owned.map((ambient) => ambient.slug))
    const claimedAmbientIds: string[] = []
    const discardedAmbientIds: string[] = []

    for (const ambient of session.ambients) {
      if (!holdsGuestWork(ambient)) {
        discardedAmbientIds.push(ambient.id)
        continue
      }
      await transaction.ambient.update({
        where: { id: ambient.id },
        data: {
          ownerId: user.id,
          guestSessionId: null,
          slug: nextFreeSlug(ambient, takenSlugs),
        },
      })
      claimedAmbientIds.push(ambient.id)
    }

    if (discardedAmbientIds.length > 0) {
      await transaction.ambient.deleteMany({ where: { id: { in: discardedAmbientIds } } })
    }
    await transaction.guestSession.update({
      where: { id: session.id },
      data: { claimedAt: new Date(), claimedBy: user.id },
    })
    return { claimedAmbientIds, discardedAmbientIds }
  }, { isolationLevel: 'Serializable' })

  // Two tabs can both act on the same stored claim intent after sign in; the loser sees a write
  // conflict even though the claim itself is fine to repeat.
  try {
    return await claim()
  } catch (error) {
    if (!isWriteConflict(error)) throw error
    return await claim()
  }
}

export const createAgentAccess: CreateAgentAccess<CreateAgentAccessInput, AgentSessionDto> = async (
  args,
  context,
) => {
  const input = parseInput(ambientIdInputSchema, args)
  const { ambientId } = input
  const ambientAccess = await resolveAmbientAccess(context, input)
  const access = createAgentSessionAccess()

  const generation = await prisma.$transaction(async (transaction) => {
    const ambient = await transaction.ambient.findFirst({
      where: { id: ambientId, ...ambientAccess.scope },
      include: { draft: true },
    })
    if (!ambient) throw new HttpError(404, 'Theme not found.')

    if (!ambient.draft) {
      if (ambient.currentVersion === null) throw new HttpError(404, 'Theme draft not found.')
      const current = await transaction.ambientVersion.findUnique({
        where: { ambientId_version: { ambientId, version: ambient.currentVersion } },
      })
      if (!current) throw new HttpError(404, 'Theme version not found.')
      const maximum = await transaction.ambientVersion.aggregate({
        where: { ambientId },
        _max: { draftRevision: true },
      })
      const revision = (maximum._max.draftRevision ?? -1) + 1
      await transaction.ambientDraft.create({
        data: {
          ambientId,
          revision,
          baseRevision: revision,
          sourceVersion: current.version,
          schemaVersion: current.schemaVersion,
          document: serializeDocument(readDocument(current.document)),
          updatedBy: ambientAccess.actor,
        },
      })
    }

    const updated = await transaction.ambient.update({
      where: { id: ambientId },
      data: { agentSessionGeneration: { increment: 1 } },
      select: { agentSessionGeneration: true },
    })
    const now = new Date()
    await transaction.ambientAgentSession.updateMany({
      where: { ambientId, expiresAt: { gt: now } },
      data: { expiresAt: now },
    })
    await transaction.ambientAgentSession.create({
      data: {
        ambientId,
        capabilityHash: hashAgentCapability(access.capability),
        createdBy: ambientAccess.actor,
        expiresAt: access.expiresAt,
        generation: updated.agentSessionGeneration,
      },
    })
    return updated.agentSessionGeneration
  }, { isolationLevel: 'Serializable' })

  publishAmbientChange({ ambientId })
  return { ambientId, generation, expiresAt: access.expiresAt.toISOString(), url: access.url }
}

export const discardAgentAccess: DiscardAgentAccess<DiscardAgentAccessInput, void> = async (args, context) => {
  const input = parseInput(ambientIdInputSchema, args)
  const { ambientId } = input
  const access = await resolveAmbientAccess(context, input)
  await prisma.$transaction(async (transaction) => {
    const ambient = await transaction.ambient.updateMany({
      where: { id: ambientId, ...access.scope },
      data: { agentSessionGeneration: { increment: 1 } },
    })
    if (ambient.count === 0) throw new HttpError(404, 'Theme not found.')
    await transaction.ambientAgentSession.updateMany({
      where: { ambientId, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    })
  }, { isolationLevel: 'Serializable' })
  publishAmbientChange({ ambientId })
}

export const syncAmbientDraft: SyncAmbientDraft<SyncAmbientDraftInput, SyncAmbientDraftResult> = async (
  args,
  context,
) => {
  const input = parseInput(syncAmbientDraftInputSchema, args)
  const access = await resolveAmbientAccess(context, input)
  const invalidatesWorkspace = (token: AmbientSyncTokenDto) =>
    token.agentSessionGeneration !== input.knownAgentSessionGeneration
    || token.currentVersion !== input.knownCurrentVersion
    || token.revision === null
    || token.revision < (input.knownRevision ?? -1)

  const status = await context.entities.Ambient.findFirst({
    where: { id: input.ambientId, ...access.scope },
    select: {
      agentSessionGeneration: true,
      currentVersion: true,
      draft: { select: { revision: true } },
    },
  })
  if (!status) throw new HttpError(404, 'Theme not found.')

  const statusToken = createSyncToken(
    status.draft?.revision ?? null,
    status.agentSessionGeneration,
    status.currentVersion,
  )
  if (invalidatesWorkspace(statusToken)) {
    return { kind: 'workspace-invalidated', token: statusToken }
  }
  if (statusToken.revision === input.knownRevision) {
    return { kind: 'unchanged', token: statusToken }
  }

  const ambient = await context.entities.Ambient.findFirst({
    where: { id: input.ambientId, ...access.scope },
    select: {
      name: true,
      agentSessionGeneration: true,
      currentVersion: true,
      draft: true,
    },
  })
  if (!ambient?.draft) return { kind: 'workspace-invalidated', token: statusToken }

  const draftToken = createSyncToken(
    ambient.draft.revision,
    ambient.agentSessionGeneration,
    ambient.currentVersion,
  )
  if (invalidatesWorkspace(draftToken)) {
    return { kind: 'workspace-invalidated', token: draftToken }
  }
  return {
    kind: 'draft-changed',
    token: draftToken,
    name: ambient.name,
    draft: toWorkingDraftDto(ambient.draft),
  }
}

export const saveAmbientVersion: SaveAmbientVersion<SaveAmbientVersionInput, SavedAmbientVersionDto> = async (
  args,
  context,
) => {
  const user = requireUser(context.user)
  const input = parseInput(saveAmbientVersionInputSchema, args)
  const record = await prisma.$transaction(async (transaction) => {
    const ambient = await transaction.ambient.findFirst({
      where: { id: input.ambientId, ownerId: user.id },
      select: { id: true, currentVersion: true },
    })
    if (!ambient) throw new HttpError(404, 'Theme not found.')
    const draft = await transaction.ambientDraft.findUnique({ where: { ambientId: input.ambientId } })
    if (!draft) throw new HttpError(404, 'Theme draft not found.')
    if (draft.revision !== input.draftRevision) {
      throw new HttpError(409, 'The theme draft changed. Review the latest revision before saving.')
    }
    const document = readDocument(draft.document)
    const lastVersion = await transaction.ambientVersion.findFirst({
      where: { ambientId: input.ambientId },
      orderBy: { version: 'desc' },
      select: { version: true, draftRevision: true, document: true },
    })
    if (
      lastVersion?.draftRevision === draft.revision
      || (lastVersion && documentsEqual(readDocument(lastVersion.document), document))
    ) {
      throw new HttpError(409, 'The working draft matches the version in use.')
    }

    const version = await transaction.ambientVersion.create({
      data: {
        ambientId: input.ambientId,
        version: (lastVersion?.version ?? 0) + 1,
        draftRevision: draft.revision,
        schemaVersion: document.schemaVersion,
        document: serializeDocument(document),
        createdBy: user.id,
      },
    })
    await transaction.ambient.update({
      where: { id: input.ambientId },
      data: { currentVersion: version.version, status: 'PUBLISHED', name: document.name },
    })
    const updatedDraft = await transaction.ambientDraft.updateMany({
      where: { ambientId: input.ambientId, revision: draft.revision },
      data: { baseRevision: draft.revision, sourceVersion: version.version },
    })
    if (updatedDraft.count === 0) {
      throw new HttpError(409, 'The theme draft changed while the version was being saved.')
    }
    return version
  }, { isolationLevel: 'Serializable' })

  publishAmbientChange({ ambientId: input.ambientId })
  return toVersionDto(record)
}

export const createDraftFromVersion: CreateDraftFromVersion<
  CreateDraftFromVersionInput,
  WorkspaceDraftRevisionDto
> = async (args, context) => {
  const user = requireUser(context.user)
  const input = parseInput(createDraftFromVersionInputSchema, args)
  const result = await prisma.$transaction(async (transaction) => {
    const ambient = await transaction.ambient.findFirst({
      where: { id: input.ambientId, ownerId: user.id },
      select: { id: true, name: true, draft: { select: { revision: true } } },
    })
    if (!ambient) throw new HttpError(404, 'Theme not found.')
    const version = await transaction.ambientVersion.findFirst({
      where: { id: input.versionId, ambientId: input.ambientId },
    })
    if (!version) throw new HttpError(404, 'Theme version not found.')
    const versionDocument = readDocument(version.document)
    const maximum = await transaction.ambientVersion.aggregate({
      where: { ambientId: input.ambientId },
      _max: { draftRevision: true },
    })
    const revision = Math.max(ambient.draft?.revision ?? -1, maximum._max.draftRevision ?? -1) + 1
    const draft = await transaction.ambientDraft.upsert({
      where: { ambientId: input.ambientId },
      create: {
        ambientId: input.ambientId,
        revision,
        baseRevision: revision,
        sourceVersion: version.version,
        schemaVersion: version.schemaVersion,
        document: serializeDocument(versionDocument),
        updatedBy: user.id,
      },
      update: {
        revision,
        baseRevision: revision,
        sourceVersion: version.version,
        schemaVersion: version.schemaVersion,
        document: serializeDocument(versionDocument),
        updatedBy: user.id,
      },
    })
    const now = new Date()
    const updatedAmbient = await transaction.ambient.update({
      where: { id: input.ambientId },
      data: {
        name: versionDocument.name,
        agentSessionGeneration: { increment: 1 },
      },
    })
    await transaction.ambientAgentSession.updateMany({
      where: { ambientId: input.ambientId, expiresAt: { gt: now } },
      data: { expiresAt: now },
    })
    return { ambient: updatedAmbient, draft }
  }, { isolationLevel: 'Serializable' })

  publishAmbientChange({ ambientId: input.ambientId })
  return {
    ambientId: result.ambient.id,
    name: result.ambient.name,
    revision: result.draft.revision,
    document: readDocument(result.draft.document),
  }
}

export const discardAmbientDraft: DiscardAmbientDraft<
  DiscardAmbientDraftInput,
  DiscardAmbientDraftResult
> = async (args, context) => {
  const input = parseInput(ambientIdInputSchema, args)
  const { ambientId } = input
  const access = await resolveAmbientAccess(context, input)
  const result = await prisma.$transaction(async (transaction) => {
    const ambient = await transaction.ambient.findFirst({
      where: { id: ambientId, ...access.scope },
      select: { id: true, _count: { select: { versions: true } } },
    })
    if (!ambient) throw new HttpError(404, 'Theme not found.')
    if (ambient._count.versions === 0) {
      await transaction.ambient.delete({ where: { id: ambientId } })
      return { ambientDeleted: true }
    }
    const now = new Date()
    await transaction.ambient.update({
      where: { id: ambientId },
      data: { agentSessionGeneration: { increment: 1 } },
    })
    await transaction.ambientAgentSession.updateMany({
      where: { ambientId, expiresAt: { gt: now } },
      data: { expiresAt: now },
    })
    await transaction.ambientDraft.deleteMany({ where: { ambientId } })
    return { ambientDeleted: false }
  }, { isolationLevel: 'Serializable' })
  publishAmbientChange({ ambientId })
  return result
}

export const deleteAmbient: DeleteAmbient<DeleteAmbientInput, void> = async (args, context) => {
  const input = parseInput(ambientIdInputSchema, args)
  const { ambientId } = input
  const access = await resolveAmbientAccess(context, input)
  // Drafts, versions, and agent sessions cascade with the ambient row.
  const deleted = await prisma.ambient.deleteMany({ where: { id: ambientId, ...access.scope } })
  if (deleted.count === 0) throw new HttpError(404, 'Theme not found.')
  publishAmbientChange({ ambientId })
}
