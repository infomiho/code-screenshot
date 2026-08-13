import '../index.css'
import './automation-docs.css'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { routes } from 'wasp/client/router'
import { SiteFooter } from '../site-footer'
import { SiteHeader } from '../site-header'
import { countDraftAmbients, type AmbientWorkspaceService } from '../ambient/management/ambient-workspace-service'
import { useAmbientWorkspace } from '../ambient/management/use-ambient-workspace'

export function AutomationDocsPage({ ambientWorkspaceService }: { ambientWorkspaceService?: AmbientWorkspaceService }) {
  const navigate = useNavigate()
  const { service, snapshot } = useAmbientWorkspace(ambientWorkspaceService)

  return (
    <div className="automation-docs-shell">
      <SiteHeader
        account={snapshot.account}
        isHydrated={snapshot.isHydrated}
        draftCount={countDraftAmbients(snapshot.ownedAmbients)}
        onOpenLibrary={() => navigate(routes.YourAmbientsRoute.to)}
        onOpenAdmin={() => navigate(routes.AdminRoute.to)}
        onSignIn={service.signIn}
        onSignOut={() => void service.signOut()}
      />

      <main className="automation-docs-main" id="main-content">
        <article className="automation-docs-document">
          <h1>Automation docs</h1>
          <p>Use the <a href="https://www.npmjs.com/package/codeshot.dev">codeshot.dev CLI</a> to create code screenshots from a terminal, agent, or CI job. Run it with <code>npx codeshot.dev</code>, with no install or API key required.</p>

          <section aria-labelledby="cli-heading">
            <h2 id="cli-heading">Quick start</h2>
            <p>Render a local source file as a PNG. The CLI infers the language from the file extension.</p>
            <CliExample />
            <p>The screenshot is saved to <code>screenshot.png</code>.</p>
            <p>To render code produced by another command, pipe it into the CLI and omit the file. Set <code>--language</code> because there is no file extension to infer it from.</p>
            <StdinExample />
          </section>

          <section aria-labelledby="commands-heading">
            <h2 id="commands-heading">Commands</h2>
            <dl className="automation-docs-commands">
              <div>
                <dt><code>render [file]</code></dt>
                <dd>Create a PNG from a source file or stdin.</dd>
              </div>
              <div>
                <dt><code>themes</code></dt>
                <dd>List the included themes.</dd>
              </div>
              <div>
                <dt><code>theme &lt;reference&gt;</code></dt>
                <dd>Resolve a theme name, share reference, or share URL to an exact version.</dd>
              </div>
              <div>
                <dt><code>capabilities</code></dt>
                <dd>Show supported languages, themes, and limits.</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="themes-heading">
            <h2 id="themes-heading">Themes</h2>
            <p>Built-in names such as <code>macos</code> work directly. For your own theme, enable link sharing and pass its share URL or <code>share:</code> reference.</p>
            <SharedThemeExample />
            <p>Run <code>npx codeshot.dev themes --json</code> for included themes or <code>npx codeshot.dev theme &lt;reference&gt; --json</code> to resolve an exact version.</p>
          </section>

          <section aria-labelledby="api-heading">
            <h2 id="api-heading">Direct API</h2>
            <p>Call the public API directly when you do not want to use the CLI. <code>POST /v1/screenshots</code> returns the PNG bytes synchronously; errors use structured JSON.</p>
            <ApiExample />
            <p><a href="https://api.codeshot.dev/v1/capabilities">View supported API capabilities</a>.</p>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  )
}

// Keep these examples in sync when changing the CLI arguments or screenshot API contract.
function CliExample() {
  return (
    <CodeBlock>
      {'npx codeshot.dev render src/app.tsx \\\n  --theme macos \\\n  --output screenshot.png'}
    </CodeBlock>
  )
}

function StdinExample() {
  return (
    <CodeBlock>
      {`printf 'const answer = 42' | npx codeshot.dev render \\
  --language typescript \\
  --output screenshot.png`}
    </CodeBlock>
  )
}

function SharedThemeExample() {
  return (
    <CodeBlock>
      {'npx codeshot.dev render src/app.tsx \\\n  --theme https://codeshot.dev/a/SHARE_ID \\\n  --output screenshot.png\n\n'}
      <span className="automation-docs-token-muted"># Pin a published version for reproducible output</span>
      {'\nnpx codeshot.dev render src/app.tsx \\\n  --theme share:SHARE_ID@2 \\\n  --output screenshot.png'}
    </CodeBlock>
  )
}

function ApiExample() {
  return (
    <CodeBlock>
      {`curl https://api.codeshot.dev/v1/screenshots \\
  --fail-with-body \\
  --output screenshot.png \\
  --header 'Content-Type: application/json' \\
  --data '{
    "code": "const answer = 42",
    "language": "typescript",
    "title": "answer.ts",
    "theme": "macos",
    "width": 860,
    "scale": 2
  }'`}
    </CodeBlock>
  )
}

function CodeBlock({ children }: { children: ReactNode }) {
  return (
    <pre className="automation-docs-code">
      <code>{children}</code>
    </pre>
  )
}
