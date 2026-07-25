import { createHash, randomBytes } from 'node:crypto'

// Bearer secrets are handed out once and stored only as a hash, so a database
// leak cannot be replayed against the API.
export const createAccessToken = () => randomBytes(32).toString('base64url')

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
