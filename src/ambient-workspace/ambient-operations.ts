import { randomBytes } from 'node:crypto'
import { HttpError, prisma } from 'wasp/server'
import type {
  CreateAmbient,
  CreateAmbientAgentSession,
  GetAmbientDraft,
  GetAmbientDraftRevision,
  GetAmbientWorkspace,
  PublishAmbient,
} from 'wasp/server/operations'
import { compileAmbientDocument } from '../ambient-compiler'
import type { AmbientDocument } from '../ambient-schema'
import {
  ambientIdInputSchema,
  createAmbientInputSchema,
  publishAmbientInputSchema,
} from './contracts'
import type {
  AgentSessionDto,
  CreateAgentSessionInput,
  CreateAmbientInput,
  CreateAmbientResult,
  PublishAmbientInput,
  PublishedAmbientDto,
  WorkspaceDocumentDto,
  WorkspaceDraftRevisionDto,
  WorkspaceDraftStatusDto,
  WorkspaceSnapshotDto,
} from './contracts'
import type { ZodType } from 'zod'
import { createMinimalDraftDocument } from './minimal-draft'
import {
  createAgentSessionAccess,
  hashAgentCapability,
} from './agent-session-access'

type AmbientIdInput = { ambientId: string }

const requireUser = <T extends { id: string }>(user: T | undefined): T => {
  if (!user) throw new HttpError(401, 'Sign in with GitHub to manage ambients.')
  return user
}

const parseInput = <Value>(
  schema: ZodType<Value>,
  value: unknown,
) => {
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

const getWorkspacePhase = (
  draftRevision: number | undefined,
  publishedDraftRevision: number | undefined,
) => {
  if (draftRevision === undefined) return null
  if (draftRevision === 0) return 'handoff' as const
  return publishedDraftRevision === draftRevision ? 'saved' as const : 'review' as const
}

const getOwnedAmbient = async (
  Ambient: typeof prisma.ambient,
  ambientId: string,
  ownerId: string,
) => {
  const ambient = await Ambient.findFirst({
    where: { id: ambientId, ownerId },
    include: { draft: true },
  })
  if (!ambient) throw new HttpError(404, 'Ambient not found.')
  return ambient
}

export const getAmbientWorkspace: GetAmbientWorkspace<void, WorkspaceSnapshotDto> = async (
  _args,
  context,
) => {
  const user = context.user
  if (!user) {
    return { account: { kind: 'signed-out' }, draft: null, savedAmbients: [] }
  }

  const ambients = await context.entities.Ambient.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: 'desc' },
    include: {
      draft: true,
      versions: { orderBy: { version: 'desc' }, take: 1 },
      agentSessions: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })
  const activeAmbient = ambients.find((ambient) =>
    ambient.id === user.activeAmbientId && ambient.draft !== null,
  )
  const activeVersion = activeAmbient?.versions[0]
  const activeSession = activeAmbient?.agentSessions.find((session) =>
    session.generation === activeAmbient.agentSessionGeneration && session.expiresAt > new Date(),
  )
  const phase = getWorkspacePhase(
    activeAmbient?.draft?.revision,
    activeVersion?.draftRevision,
  )

  return {
    account: {
      kind: 'signed-in',
      username: user.githubLogin,
    },
    draft: activeAmbient?.draft && phase
      ? {
          id: activeAmbient.id,
          phase,
          ambientName: activeAmbient.name,
          promptExpiresAt: activeSession?.expiresAt.toISOString() ?? null,
          agentSessionGeneration: activeAmbient.agentSessionGeneration,
          revision: activeAmbient.draft.revision,
          document: readDocument(activeAmbient.draft.document),
        }
      : null,
    savedAmbients: ambients.flatMap((ambient) => {
      const version = ambient.versions[0]
      return version
        ? [{
            id: ambient.id,
            version: version.version,
            document: readDocument(version.document),
          }]
        : []
    }),
  }
}

export const createAmbient: CreateAmbient<CreateAmbientInput, CreateAmbientResult> = async (
  args,
  context,
) => {
  const user = requireUser(context.user)
  const input = parseInput(createAmbientInputSchema, args)
  const { name } = input

  const document = createMinimalDraftDocument(name)
  const access = createAgentSessionAccess()
  const ambient = await prisma.$transaction(async (transaction) => {
    const created = await transaction.ambient.create({
      data: {
        ownerId: user.id,
        slug: slugify(name),
        name,
        draft: {
          create: {
            revision: 0,
            schemaVersion: document.schemaVersion,
            document: serializeDocument(document),
            updatedBy: user.id,
          },
        },
        agentSessions: {
          create: {
            capabilityHash: hashAgentCapability(access.capability),
            createdBy: user.id,
            expiresAt: access.expiresAt,
            generation: 0,
          },
        },
      },
    })
    await transaction.user.update({
      where: { id: user.id },
      data: { activeAmbientId: created.id },
    })
    return created
  })
  return {
    ambientId: ambient.id,
    session: {
      ambientId: ambient.id,
      generation: 0,
      expiresAt: access.expiresAt.toISOString(),
      url: access.url,
    },
  }
}

export const createAmbientAgentSession: CreateAmbientAgentSession<
  CreateAgentSessionInput,
  AgentSessionDto
> = async (args, context) => {
  const user = requireUser(context.user)
  const { ambientId } = parseInput(ambientIdInputSchema, args)
  await getOwnedAmbient(prisma.ambient, ambientId, user.id)

  const access = createAgentSessionAccess()
  const generation = await prisma.$transaction(async (transaction) => {
    const ambient = await transaction.ambient.update({
      where: { id: ambientId, ownerId: user.id },
      data: { agentSessionGeneration: { increment: 1 } },
      select: { agentSessionGeneration: true },
    })
    await transaction.ambientAgentSession.updateMany({
      where: { ambientId, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    })
    await transaction.ambientAgentSession.create({
      data: {
        ambientId,
        capabilityHash: hashAgentCapability(access.capability),
        createdBy: user.id,
        expiresAt: access.expiresAt,
        generation: ambient.agentSessionGeneration,
      },
    })
    return ambient.agentSessionGeneration
  })

  return {
    ambientId,
    generation,
    expiresAt: access.expiresAt.toISOString(),
    url: access.url,
  }
}

export const getAmbientDraftRevision: GetAmbientDraftRevision<AmbientIdInput, WorkspaceDraftStatusDto> = async (
  args,
  context,
) => {
  const user = requireUser(context.user)
  const { ambientId } = parseInput(ambientIdInputSchema, args)
  const ambient = await getOwnedAmbient(context.entities.Ambient, ambientId, user.id)
  if (!ambient.draft) throw new HttpError(404, 'Ambient draft not found.')
  return {
    revision: ambient.draft.revision,
    agentSessionGeneration: ambient.agentSessionGeneration,
  }
}

export const getAmbientDraft: GetAmbientDraft<AmbientIdInput, WorkspaceDraftRevisionDto> = async (
  args,
  context,
) => {
  const user = requireUser(context.user)
  const { ambientId } = parseInput(ambientIdInputSchema, args)
  const ambient = await getOwnedAmbient(context.entities.Ambient, ambientId, user.id)
  if (!ambient.draft) throw new HttpError(404, 'Ambient draft not found.')
  return {
    ambientId: ambient.id,
    name: ambient.name,
    revision: ambient.draft.revision,
    document: readDocument(ambient.draft.document),
  }
}

export const publishAmbient: PublishAmbient<PublishAmbientInput, PublishedAmbientDto> = async (
  args,
  context,
) => {
  const user = requireUser(context.user)
  const input = parseInput(publishAmbientInputSchema, args)
  const { ambientId } = input
  const created = await prisma.$transaction(async (transaction) => {
    const ambient = await transaction.ambient.findFirst({
      where: { id: ambientId, ownerId: user.id },
      select: { currentVersion: true },
    })
    if (!ambient) throw new HttpError(404, 'Ambient not found.')

    const claimedDraft = await transaction.ambientDraft.updateMany({
      where: { ambientId, revision: input.draftRevision },
      data: { updatedAt: new Date() },
    })
    if (claimedDraft.count === 0) {
      throw new HttpError(409, 'The ambient draft changed. Review the latest revision before saving.')
    }
    const draft = await transaction.ambientDraft.findUnique({ where: { ambientId } })
    if (!draft) throw new HttpError(404, 'Ambient draft not found.')
    const existingVersion = await transaction.ambientVersion.findFirst({
      where: { ambientId, draftRevision: draft.revision },
    })
    if (existingVersion) {
      throw new HttpError(409, 'This draft revision is already saved.')
    }

    const nextVersion = (ambient.currentVersion ?? 0) + 1
    const claimedAmbient = await transaction.ambient.updateMany({
      where: { id: ambientId, ownerId: user.id, currentVersion: ambient.currentVersion },
      data: { currentVersion: nextVersion, status: 'PUBLISHED' },
    })
    if (claimedAmbient.count === 0) {
      throw new HttpError(409, 'This draft was already saved. Refresh before saving again.')
    }

    const document = readDocument(draft.document)
    const record = await transaction.ambientVersion.create({
      data: {
        ambientId,
        version: nextVersion,
        draftRevision: draft.revision,
        schemaVersion: document.schemaVersion,
        document: serializeDocument(document),
        createdBy: user.id,
      },
    })
    await transaction.ambient.update({
      where: { id: ambientId },
      data: { name: document.name },
    })
    return { document, record }
  })

  return {
    id: ambientId,
    version: created.record.version,
    draftRevision: created.record.draftRevision,
    document: created.document,
    createdAt: created.record.createdAt.toISOString(),
  }
}
