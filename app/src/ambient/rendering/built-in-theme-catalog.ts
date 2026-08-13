export const builtInThemes = [
  { id: 'macos', version: 1 },
  { id: 'technical-plate', version: 1 },
  { id: 'specimen-card', version: 1 },
  { id: 'swiss-poster', version: 2 },
  { id: 'field-notebook', version: 1 },
  { id: 'bare-terminal', version: 1 },
] as const

export type BuiltInTheme = (typeof builtInThemes)[number]

export const findBuiltInTheme = (id: string, version?: number): BuiltInTheme | undefined =>
  builtInThemes.find((theme) => theme.id === id && (version === undefined || theme.version === version))
