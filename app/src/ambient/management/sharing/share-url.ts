export const getAmbientSharePath = (shareId: string, slug: string) =>
  `/a/${encodeURIComponent(shareId)}/${encodeURIComponent(slug)}`

export const getAmbientShareUrl = (shareId: string, slug: string) =>
  `${globalThis.location.origin}${getAmbientSharePath(shareId, slug)}`
