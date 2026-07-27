import { readGuestToken, storeGuestToken } from '../../account/guest-session'
import type { CreateAmbientResult } from './contracts'

const ambientCreationLock = 'codeshot.ambient-creation'
let fallbackQueue: Promise<unknown> = Promise.resolve()

type AmbientCreation = {
  created: CreateAmbientResult
  guestToken: string | null
}

const queueInThisTab = <Result>(create: () => Promise<Result>) => {
  const result = fallbackQueue.then(create, create)
  fallbackQueue = result.then(() => undefined, () => undefined)
  return result
}

export const createWithGuestSession = async (
  create: (guestToken: string | null) => Promise<CreateAmbientResult>,
): Promise<AmbientCreation> => {
  const run = async () => {
    const existingGuestToken = readGuestToken()
    const created = await create(existingGuestToken)
    if (created.guestToken) storeGuestToken(created.guestToken)
    return {
      created,
      guestToken: created.guestToken ?? existingGuestToken,
    }
  }

  const locks = globalThis.navigator?.locks
  return locks
    ? locks.request(ambientCreationLock, run)
    : queueInThisTab(run)
}
