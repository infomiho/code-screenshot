import { HttpError, prisma } from 'wasp/server'
import { createAccessToken, hashToken } from '../../account/token-hash'

// An ambient is reachable either by its signed-in owner or by the anonymous browser that made it.
// Both resolve to a Prisma scope, so every query stays a single `where: { id, ...scope }`.
export type AmbientAccess =
  | { kind: 'user'; scope: { ownerId: string }; actor: string }
  | { kind: 'guest'; scope: { guestSessionId: string }; actor: string }

type AmbientAccessContext = { user?: { id: string } | null }

export type GuestCredential = { guestToken?: string }

// The resolver reaches for Prisma directly rather than `context.entities`, because it runs inside
// operations whose declared entity sets differ and would not all include GuestSession.
export const findGuestSession = async (guestToken: string | undefined) => {
  if (!guestToken) return null
  const session = await prisma.guestSession.findUnique({
    where: { tokenHash: hashToken(guestToken) },
    select: { id: true, claimedAt: true },
  })
  return session?.claimedAt === null ? { id: session.id } : null
}

// The server always mints the secret. A token supplied by the client is only ever looked up, never
// adopted, so token entropy can never be chosen by the caller.
export const startGuestSession = async () => {
  const token = createAccessToken()
  const session = await prisma.guestSession.create({
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
  scope: { ownerId: string } | { guestSessionId: string }
  actor: string
  // Set only when this call started a new anonymous session, so the browser stores the secret once.
  mintedGuestToken?: string
}

// Creating a theme is the one entry point that may start an anonymous session rather than require one.
export const resolveAmbientOwner = async (
  context: AmbientAccessContext,
  credential: GuestCredential,
): Promise<AmbientOwner> => {
  if (context.user) {
    return { scope: { ownerId: context.user.id }, actor: context.user.id }
  }
  const existing = await findGuestSession(credential.guestToken)
  if (existing) {
    return { scope: { guestSessionId: existing.id }, actor: guestActor(existing.id) }
  }
  const session = await startGuestSession()
  return {
    scope: { guestSessionId: session.id },
    actor: guestActor(session.id),
    mintedGuestToken: session.token,
  }
}
