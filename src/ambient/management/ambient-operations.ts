import { randomBytes } from 'node:crypto'
import { HttpError, prisma } from 'wasp/server'
import type {
  CreateAgentAccess,
  CreateAmbient,
  CreateDraftFromVersion,
  DeleteAmbient,
  DiscardAgentAccess,
  DiscardAmbientDraft,
  GetAmbientWorkspace,
  GetSharedAmbient,
  ListOwnedAmbients,
  SaveAmbientVersion,
  SetAmbientLinkSharing,
  SyncAmbientDraft,
} from 'wasp/server/operations'
import type { ZodType } from 'zod'
import { compileAmbientDocument } from '../compiler'
import type { AmbientDocument } from '../schema'
import { createAgentSessionAccess, hashAgentCapability } from './agent/agent-session-access'
import { publishAmbientChange } from './ambient-change-stream'
import {
  ambientIdInputSchema,
  createAmbientInputSchema,
  createDraftFromVersionInputSchema,
  createSyncToken,
  deriveDraftStatus,
  documentsEqual,
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
  CreateAgentAccessInput,
  CreateAmbientInput,
  CreateAmbientResult,
  CreateDraftFromVersionInput,
  DiscardAgentAccessInput,
  DiscardAmbientDraftInput,
  DiscardAmbientDraftResult,
  OwnedAmbientDraftSummaryDto,
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

const requireUser = <T extends { id: string }>(user: T | undefined): T => {
  if (!user) throw new HttpError(401, 'Sign in with GitHub to manage ambients.')
  return user
}

const parseInput = <Value>(schema: ZodType<Value>, value: unknown) => {
  const result = schema.safeParse(value)
  if (!result.success) throw new HttpError(400, 'Invalid request.')
  return result.data
}

const readDocument = (value: unknown): WorkspaceDocumentDto => {
  const result = compileAmbientDocument(value)
  if (!result.compiled) throw new HttpError(500, 'Stored ambient is invalid.')
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
    account: { kind: 'signed-in', username: user.githubLogin, avatarUrl: user.githubAvatarUrl ?? null },
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
  const user = requireUser(context.user)
  const { ambientId } = parseInput(ambientIdInputSchema, args)
  const ambient = await context.entities.Ambient.findFirst({
    where: { id: ambientId, ownerId: user.id },
    include: {
      draft: true,
      versions: { orderBy: { version: 'desc' } },
      agentSessions: { orderBy: { generation: 'desc' }, take: 1 },
    },
  })
  if (!ambient) throw new HttpError(404, 'Ambient not found.')

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
  if (!ambient?.currentVersion) throw new HttpError(404, 'Shared ambient not found.')

  const version = await context.entities.AmbientVersion.findUnique({
    where: { ambientId_version: { ambientId: ambient.id, version: ambient.currentVersion } },
  })
  if (!version) throw new HttpError(404, 'Shared ambient not found.')

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
  if (!ambient) throw new HttpError(404, 'Ambient not found.')
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
  const user = requireUser(context.user)
  const { name } = parseInput(createAmbientInputSchema, args)
  const document = createMinimalDraftDocument(name)
  const ambient = await context.entities.Ambient.create({
    data: {
      ownerId: user.id,
      slug: slugify(name),
      name,
      draft: {
        create: {
          revision: 0,
          baseRevision: 0,
          sourceVersion: null,
          schemaVersion: document.schemaVersion,
          document: serializeDocument(document),
          updatedBy: user.id,
        },
      },
    },
  })
  return { ambientId: ambient.id }
}

export const createAgentAccess: CreateAgentAccess<CreateAgentAccessInput, AgentSessionDto> = async (
  args,
  context,
) => {
  const user = requireUser(context.user)
  const { ambientId } = parseInput(ambientIdInputSchema, args)
  const access = createAgentSessionAccess()

  const generation = await prisma.$transaction(async (transaction) => {
    const ambient = await transaction.ambient.findFirst({
      where: { id: ambientId, ownerId: user.id },
      include: { draft: true },
    })
    if (!ambient) throw new HttpError(404, 'Ambient not found.')

    if (!ambient.draft) {
      if (ambient.currentVersion === null) throw new HttpError(404, 'Ambient draft not found.')
      const current = await transaction.ambientVersion.findUnique({
        where: { ambientId_version: { ambientId, version: ambient.currentVersion } },
      })
      if (!current) throw new HttpError(404, 'Ambient version not found.')
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
          updatedBy: user.id,
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
        createdBy: user.id,
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
  const user = requireUser(context.user)
  const { ambientId } = parseInput(ambientIdInputSchema, args)
  await prisma.$transaction(async (transaction) => {
    const ambient = await transaction.ambient.updateMany({
      where: { id: ambientId, ownerId: user.id },
      data: { agentSessionGeneration: { increment: 1 } },
    })
    if (ambient.count === 0) throw new HttpError(404, 'Ambient not found.')
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
  const user = requireUser(context.user)
  const input = parseInput(syncAmbientDraftInputSchema, args)
  const invalidatesWorkspace = (token: AmbientSyncTokenDto) =>
    token.agentSessionGeneration !== input.knownAgentSessionGeneration
    || token.currentVersion !== input.knownCurrentVersion
    || token.revision === null
    || token.revision < (input.knownRevision ?? -1)

  const status = await context.entities.Ambient.findFirst({
    where: { id: input.ambientId, ownerId: user.id },
    select: {
      agentSessionGeneration: true,
      currentVersion: true,
      draft: { select: { revision: true } },
    },
  })
  if (!status) throw new HttpError(404, 'Ambient not found.')

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
    where: { id: input.ambientId, ownerId: user.id },
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
    if (!ambient) throw new HttpError(404, 'Ambient not found.')
    const draft = await transaction.ambientDraft.findUnique({ where: { ambientId: input.ambientId } })
    if (!draft) throw new HttpError(404, 'Ambient draft not found.')
    if (draft.revision !== input.draftRevision) {
      throw new HttpError(409, 'The ambient draft changed. Review the latest revision before saving.')
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
      throw new HttpError(409, 'The ambient draft changed while the version was being saved.')
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
    if (!ambient) throw new HttpError(404, 'Ambient not found.')
    const version = await transaction.ambientVersion.findFirst({
      where: { id: input.versionId, ambientId: input.ambientId },
    })
    if (!version) throw new HttpError(404, 'Ambient version not found.')
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
  const user = requireUser(context.user)
  const { ambientId } = parseInput(ambientIdInputSchema, args)
  const result = await prisma.$transaction(async (transaction) => {
    const ambient = await transaction.ambient.findFirst({
      where: { id: ambientId, ownerId: user.id },
      select: { id: true, _count: { select: { versions: true } } },
    })
    if (!ambient) throw new HttpError(404, 'Ambient not found.')
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
  const user = requireUser(context.user)
  const { ambientId } = parseInput(ambientIdInputSchema, args)
  // Drafts, versions, and agent sessions cascade with the ambient row.
  const deleted = await prisma.ambient.deleteMany({ where: { id: ambientId, ownerId: user.id } })
  if (deleted.count === 0) throw new HttpError(404, 'Ambient not found.')
  publishAmbientChange({ ambientId })
}
