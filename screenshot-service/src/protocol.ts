import { timingSafeEqual } from 'node:crypto'
import { Type, type Static } from 'typebox'
import { Value } from 'typebox/value'

const builtInThemeSchema = Type.Object({
  kind: Type.Literal('built-in'),
  id: Type.String({ minLength: 1, maxLength: 64 }),
  version: Type.Integer({ minimum: 1 }),
}, { additionalProperties: false })

const declarativeThemeSchema = Type.Object({
  kind: Type.Literal('declarative'),
  id: Type.String({ minLength: 1, maxLength: 128 }),
  version: Type.Integer({ minimum: 1 }),
  document: Type.Unknown(),
}, { additionalProperties: false })

export const screenshotRequestSchema = Type.Object({
  code: Type.String({ maxLength: 50_000 }),
  customizations: Type.Record(Type.String({ maxLength: 128 }), Type.String({ maxLength: 512 })),
  highlightedLines: Type.Array(Type.Integer({ minimum: 1 }), { maxItems: 1_000 }),
  language: Type.String({ minLength: 1, maxLength: 64 }),
  scale: Type.Union([Type.Literal(1), Type.Literal(2)]),
  theme: Type.Union([builtInThemeSchema, declarativeThemeSchema]),
  title: Type.String({ maxLength: 256 }),
  width: Type.Integer({ minimum: 420, maximum: 1280 }),
}, { additionalProperties: false })

export type ScreenshotRequest = Static<typeof screenshotRequestSchema>

export function parseScreenshotRequest(value: unknown): ScreenshotRequest {
  if (!Value.Check(screenshotRequestSchema, value)) throw new Error('Invalid request body.')
  return value
}

export function isAuthorized(authorization: string | undefined, expectedToken: string): boolean {
  if (!authorization?.startsWith('Bearer ')) return false
  const supplied = Buffer.from(authorization.slice('Bearer '.length))
  const expected = Buffer.from(expectedToken)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
