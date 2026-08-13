import { HttpError, prisma } from 'wasp/server'
import { createAccessToken, hashToken } from '../../account/token-hash'

// Both credentials resolve to a scope, so every query stays a single `where: { id, ...scope }`.
export type AmbientScope = { ownerId: string } | { guestSessionId: string }

export type AmbientAccess =
  | { kind: 'user'; scope: { ownerId: string }; actor: string }
  | { kind: 'guest'; scope: { guestSessionId: string }; actor: string }

type AmbientAccessContext = { user?: { id: string } | null }
type GuestSessionStore = Pick<typeof prisma, 'guestSession'>

export type GuestCredential = { guestToken?: string }

// Prisma directly rather than `context.entities`: not every calling operation declares GuestSession.
export const findGuestSession = async (
  guestToken: string | undefined,
  store: GuestSessionStore = prisma,
  lock = false,
) => {
  if (!guestToken) return null
  const tokenHash = hashToken(guestToken)
  if (lock) {
    await store.guestSession.updateMany({
      where: { tokenHash, claimedAt: null },
      data: { claimedAt: null },
    })
  }
  const session = await store.guestSession.findUnique({
    where: { tokenHash },
    select: { id: true, claimedAt: true },
  })
  return session?.claimedAt === null ? { id: session.id } : null
}

// A token supplied by the client is only ever looked up, never adopted, so entropy stays ours.
export const startGuestSession = async (store: GuestSessionStore = prisma) => {
  const token = createAccessToken()
  const session = await store.guestSession.create({
    data: { tokenHash: hashToken(token) },
    select: { id: true },
  })
  return { id: session.id, token }
}

const guestActor = (guestSessionId: string) => `guest:${guestSessionId}`

export const resolveAmbientAccess = async (
  context: AmbientAccessContext,
  credential: GuestCredential,
): Promise<AmbientAccess> => {
  if (context.user) {
    return { kind: 'user', scope: { ownerId: context.user.id }, actor: context.user.id }
  }
  const session = await findGuestSession(credential.guestToken)
  if (!session) throw new HttpError(401, 'Sign in with GitHub to manage themes.')
  return {
    kind: 'guest',
    scope: { guestSessionId: session.id },
    actor: guestActor(session.id),
  }
}

export type AmbientOwner = {
  scope: AmbientScope
  actor: string
  mintedGuestToken?: string
}

export const resolveAmbientOwner = async (
  context: AmbientAccessContext,
  credential: GuestCredential,
  store: GuestSessionStore = prisma,
  lock = false,
): Promise<AmbientOwner> => {
  if (context.user) {
    return { scope: { ownerId: context.user.id }, actor: context.user.id }
  }
  const existing = await findGuestSession(credential.guestToken, store, lock)
  if (existing) {
    return { scope: { guestSessionId: existing.id }, actor: guestActor(existing.id) }
  }
  const session = await startGuestSession(store)
  return {
    scope: { guestSessionId: session.id },
    actor: guestActor(session.id),
    mintedGuestToken: session.token,
  }
}
