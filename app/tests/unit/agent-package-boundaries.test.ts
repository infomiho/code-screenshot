import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = resolve(__dirname, '../..')
const packageName = '@infomiho/agent-work-protocol'

const listFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return listFiles(path)
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [path] : []
  })

const importSpecifiers = (file: string): string[] => {
  const source = readFileSync(file, 'utf8')
  return [...source.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map((match) => match[1])
}

describe('app import boundaries', () => {
  // Server entries are allowed only in files that are themselves server-only,
  // which in this app means they import wasp/server.
  const entriesFor = (specifiers: string[]) =>
    specifiers.includes('wasp/server')
      ? [packageName, `${packageName}/server`, `${packageName}/adapters/express`]
      : [packageName]

  it('app files import the package only through its declared entries', () => {
    const appFiles = listFiles(join(repoRoot, 'src'))
    expect(appFiles.length).toBeGreaterThan(0)
    for (const file of appFiles) {
      const specifiers = importSpecifiers(file)
      for (const specifier of specifiers) {
        if (!specifier.includes(packageName)) continue
        expect(
          entriesFor(specifiers).includes(specifier),
          `${relative(repoRoot, file)} imports ${specifier}`,
        ).toBe(true)
      }
    }
  })
})
