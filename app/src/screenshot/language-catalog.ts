export const languageOptions = [
  { id: 'typescript', label: 'TypeScript', lang: 'typescript' },
  { id: 'tsx', label: 'TSX', lang: 'tsx' },
  { id: 'javascript', label: 'JavaScript', lang: 'javascript' },
  { id: 'jsx', label: 'JSX', lang: 'jsx' },
  { id: 'json', label: 'JSON', lang: 'json' },
  { id: 'css', label: 'CSS', lang: 'css' },
  { id: 'html', label: 'HTML', lang: 'html' },
  { id: 'php', label: 'PHP', lang: 'php' },
  { id: 'python', label: 'Python', lang: 'python' },
  { id: 'markdown', label: 'Markdown', lang: 'markdown' },
  { id: 'text', label: 'Plain text', lang: 'text' },
] as const

export type LanguageOption = (typeof languageOptions)[number]
export type LanguageId = LanguageOption['id']

export const isLanguageId = (value: string): value is LanguageId =>
  languageOptions.some(({ id }) => id === value)
