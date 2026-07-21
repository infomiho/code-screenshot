# Saved Ambients

## Goal

Let people and agents create branded ambient shells, preview them with a live app-owned code editor, and save immutable versions. Ambient definitions are declarative data, not executable application code.

## Principles

Screenshot content is portable between ambients:

- title
- file type and syntax
- source code
- derived line count
- line highlights and annotations owned by the application

An ambient owns its design:

- inert HTML composition
- isolated CSS and typography
- padding, radius, and geometry
- decorative chrome and fixed copy
- syntax palette
- narrow semantic customization slots

The application owns CodeMirror, editing behavior, line highlighting, annotations, resizing, and export. An ambient can position the editor and theme it through a documented contract, but cannot initialize, inspect, or replace it.

Published versions are immutable. Publishing creates a version; it does not make that version public. Gallery visibility is a separate, certification-gated decision.

## Current Baseline

The React application already has:

- a source-agnostic registry of six built-in ambients
- serializable manifests and token palettes
- semantic screenshot content shared by every ambient
- manifest-declared palette and color customizations
- one persistent CodeMirror instance reparented between ambient shells
- PNG export through `modern-screenshot`

Five built-in shells remain trusted React components. Swiss Poster now runs through the schema-v1 compiler, open Shadow DOM runtime, native CodeMirror slot, documented editor variables, and real-browser export coverage. Stage 2B extends that proven boundary to hosted mutable drafts.

## Target Document

Identity and version belong to the registry or database record, not to the reusable ambient document.

```ts
type AmbientDocument = {
  schemaVersion: 1
  name: string
  editor: {
    tokens: AmbientTokenPalette
    exportGutter: 'show' | 'hide'
  }
  annotations: {
    ink: string
  }
  customizations: AmbientCustomizationSlot[]
  template: string
  stylesheet: string
  thumbnail: {
    template: string
    stylesheet: string
  }
}

type AmbientManifest = Omit<
  AmbientDocument,
  'schemaVersion' | 'template' | 'stylesheet'
>

type RegisteredAmbient = {
  id: string
  version: number
  source: 'built-in' | 'saved'
  document: AmbientDocument
}

type AmbientTokenPalette = {
  text: string
  comment: string
  string: string
  keyword: string
  number: string
  function: string
  type: string
  punctuation: string
}
```

Stage 2A implemented the document/envelope split and renamed the token palette's former `muted` field to `comment`. Before schema version 1 is persisted, Stage 2B adds the required thumbnail contract and migrates the built-in declarative fixture.

## Screenshot Content

```ts
type ScreenshotContent = {
  title: string
  fileType: {
    id: string
    label: string
    syntax: string
  }
  lineCount: number
}
```

Supported semantic sources in schema version 1:

- `title`
- `fileTypeId`
- `fileTypeLabel`
- `lineCount`
- `code`

The source code itself is never inserted as HTML. The `code` source identifies the host-owned CodeMirror slot.

## Declarative Template

Authors use inert HTML with host-defined slot elements:

```html
<article class="shell">
  <header>
    <ambient-slot name="title" fallback="Untitled" tooltip></ambient-slot>
    <ambient-slot name="fileTypeLabel"></ambient-slot>
  </header>
  <section class="code">
    <ambient-slot name="code"></ambient-slot>
  </section>
  <footer>
    <ambient-slot name="lineCount" format="pad-3"></ambient-slot>
  </footer>
</article>
```

Template rules:

- exactly one `code` slot is required
- text slots may appear more than once
- text bindings update through `textContent`, never `innerHTML`
- `fallback` applies only when a text value is empty
- `tooltip` may reflect the same resolved text into a host-owned `title` attribute
- schema version 1 supports `plain` and `pad-3` formatting
- static mood copy remains ordinary template text
- unknown slots, formats, and attributes are errors

The compiler converts the author-facing `code` slot to a native Shadow DOM `<slot name="code">`. Other ambient slots become runtime-owned binding elements. Their only optional reflected attribute is the text-only `title` produced by `tooltip`.

## Isolation And Runtime

Each declarative shell renders into an open Shadow DOM:

1. The application keeps the capture frame, width handle, and annotation layer outside the declarative shell.
2. The declarative shell host fills that frame and owns the ambient background, padding, and composition through `:host` styles.
3. The host attaches the shadow root and inserts the validated stylesheet and compiled template.
4. The single CodeMirror host remains a light-DOM child with `slot="code"`.
5. The native slot projects that host into the ambient composition.
6. The runtime updates text bindings when screenshot content changes.
7. The application applies token colors, editor variables, export-gutter behavior, and annotation ink without recreating CodeMirror.

The light-DOM boundary prevents ambient selectors from reaching CodeMirror internals. The shell host is a size container, and ambient responsive behavior uses container queries rather than application viewport queries. Open roots remain inspectable and are expected to remain exportable.

Saved ambients never provide JavaScript, custom element definitions, CodeMirror extensions, arbitrary HTML bindings, or closed shadow roots.

## Editor Contract

The host converts `AmbientTokenPalette` into its own CodeMirror highlight extension. Ambient CSS can theme editor geometry and chrome only through documented custom properties applied to the code slot, including:

- code font family, size, weight, and line height
- content and gutter padding
- editor, text, gutter, and caret colors
- highlighted-line and selected-line-number colors
- selection background

The exact property names, accepted value grammar, defaults, and bounds become part of schema version 1 in Stage 2A. A narrowly allowed `::slotted([slot="code"])` rule may set only those documented properties. Other declarations in that rule are rejected.

Saved CSS must not target `.cm-*` structure. `exportGutter` replaces the current `hideGutterOnExport` runtime flag. `annotations.ink` replaces the ambient-specific `--pen-color` currently supplied by frame classes, because the app-owned annotation layer sits outside the shadow root.

## Customizations

Customization controls are declared by the ambient and rendered by the host.

```ts
type AmbientCustomizationSlot = {
  type: 'palette'
  id: string
  label: string
  cssVariable: `--ambient-${string}`
  valueKind: 'color' | 'paint'
  defaultOptionId: string
  options: Array<{
    id: string
    label: string
    value: string
  }>
} | {
  type: 'color'
  id: string
  label: string
  cssVariable: `--ambient-${string}`
  defaultValue: string
}
```

Prefer curated palettes. Palette overrides store option IDs rather than CSS values, and the host resolves them against the versioned document. Arbitrary colors are available only when the ambient declares a color slot designed to maintain contrast.

`color` accepts only a parsed CSS color. `paint` accepts a color or an allowlisted gradient function and rejects every URL or external resource. Values are parsed and validated independently before assignment to a custom property; they are never concatenated into stylesheet text.

Customization variables must be unique, use the `--ambient-` prefix, and appear in the stylesheet in a property compatible with their value kind. Overrides are keyed by ambient ID and exact version, then applied at the shell host.

## Thumbnail Contract

Each ambient includes a dedicated agent-authored miniature for picker and dashboard cards. The thumbnail is versioned with the ambient but remains independent from the full screenshot template so the picker never mounts CodeMirror or a complete ambient shell.

```ts
type AmbientThumbnail = {
  template: string
  stylesheet: string
}
```

Thumbnail rules are stricter than ambient rules:

- one root element
- only `div`, `span`, and `i`
- no bindings, slots, text input, or dynamic content
- no URLs, assets, animations, transitions, or pointer events
- maximum 24 elements and depth 6
- maximum 2 KiB HTML and 4 KiB CSS
- host-owned dimensions, clipping, and `pointer-events: none`
- percentage, aspect-ratio, and container-relative layout instead of a fixed picker size

The agent creates the thumbnail alongside the ambient. Publishing requires both documents to validate. Built-ins can migrate to the same thumbnail representation over time.

## Validation

Validation returns stable, machine-readable diagnostics:

```ts
type AmbientDiagnostic = {
  severity: 'error' | 'warning'
  code: string
  path?: string
  message: string
}
```

### Document

- require a supported schema version and all fields
- reject unknown fields
- validate IDs, names, uniqueness, defaults, and bounded collection sizes
- validate colors and CSS values against their declared field grammar
- ensure customization defaults resolve

### HTML

Parse HTML with an allowlist. Reject scripts, event handlers, inline styles, forms, navigation, iframes, objects, media, canvas, SVG, arbitrary URL attributes, and unsupported custom elements.

Require one code slot and validate every binding, format, fallback, element, and attribute. Bound template bytes, depth, node count, and text length.

### Thumbnail

Parse the thumbnail with its dedicated HTML and CSS profiles. It cannot contain ambient slots or inherit the full template's element allowlist. Validation enforces its node, depth, byte, property, and resource limits before it can appear in the picker.

### CSS

Parse CSS with an AST rather than regular expressions. Schema version 1 rejects:

- imports, remote URLs, font faces, and asset URLs
- global document selectors and selectors targeting application UI
- selectors targeting `.cm-*` or undocumented editor structure
- unrestricted `::slotted` declarations
- viewport-dependent layout where a container query is required
- fixed or sticky positioning and viewport overlays
- keyframes, animations, and transitions
- `!important` declarations
- behavior that depends on generated external content
- unbounded expensive filters, shadows, selectors, or declaration counts

Shadow DOM provides selector isolation but does not replace validation. Authentication and ownership do not replace validation either.

### Diagnostics

Validators are deterministic and shared by the browser, server, and tests. The server always reruns validation before publishing, regardless of browser results.

Draft API diagnostics cover schema, security, supported syntax, bindings, declared values, and complexity limits. They do not claim to detect visual overflow or color contrast. Visual review happens in the browser preview; later export certification remains a separate concern.

## Export Feasibility Result

Stage 2A proved that `modern-screenshot` correctly captures:

- an open shadow root
- the slotted CodeMirror host and syntax colors
- line highlights and export-only gutter behavior
- ambient custom properties
- empty and long semantic text
- annotations layered above the shell
- required fonts at fixed dimensions

The automated fixtures cover widths of 420, 860, and 1280 px. These are certification cases, not dedicated user-facing preview controls.

Export freezes interactive state, waits for fonts and images, and captures explicit dimensions. Closed roots, opaque iframes, canvas-dependent visuals, and cross-origin resources remain unsupported.

## Stored Model

```ts
type AmbientRecord = {
  id: string
  ownerId: string
  slug: string
  name: string
  status: 'draft' | 'published' | 'archived'
  currentVersion: number | null
  galleryVersion: number | null
  createdAt: Date
  updatedAt: Date
}

type AmbientDraftRecord = {
  ambientId: string
  revision: number
  schemaVersion: number
  manifest: AmbientManifest
  template: string
  stylesheet: string
  updatedBy: string
  createdAt: Date
  updatedAt: Date
}

type AmbientVersionRecord = {
  ambientId: string
  version: number
  schemaVersion: number
  manifest: AmbientManifest
  template: string
  stylesheet: string
  createdBy: string
  certificationStatus: 'pending' | 'passed' | 'failed'
  createdAt: Date
}

type AmbientAgentSessionRecord = {
  id: string
  ambientId: string
  capabilityHash: string
  createdBy: string
  expiresAt: Date
  lastUsedAt: Date | null
  createdAt: Date
}
```

`AmbientDraftRecord.ambientId` is unique. `(ambientId, version)` uniquely identifies an immutable version. Publishing runs in a transaction:

1. authorize the signed-in owner against the ambient
2. compare the submitted base revision with the current draft revision
3. rerun deterministic validation
4. create the next immutable version
5. update `currentVersion`, status, and denormalized name

The draft remains available for subsequent edits. The record's name is denormalized for listings and kept in sync on draft writes and publishing. `galleryVersion` may reference only a certified version and can differ from `currentVersion`, allowing a new private version without removing the previous gallery version. Future saved screenshots or presets must reference an exact ambient ID and version. Screenshot persistence itself is not part of Stage 2.

The main picker displays one entry per ambient ID, resolved to `currentVersion`. Publishing version 2 updates the existing picker entry instead of creating a second theme. Old versions remain available only through version history and exact saved references. Creating a separate picker entry requires an explicit duplicate operation.

## Ownership And Agents

The screenshot editor remains usable anonymously. Creating, saving, connecting an agent, and publishing an ambient require GitHub sign-in. GitHub identity owns the ambient; GitHub credentials are never passed to an agent.

The user generates a ready-to-paste agent prompt containing an opaque capability URL. The capability is the credential, so there is no separate bearer environment variable. Each session:

- can read and replace one ambient draft
- cannot publish, delete, duplicate, or access account data
- expires after 24 hours
- stores only a hash server-side
- resumes from the same draft when replaced by a new session
- returns an explicit instruction to ask the user for a new prompt after expiration

Capability values must be redacted from application and proxy logs. Capability routes send `Cache-Control: no-store` and `Referrer-Policy: no-referrer`, load no third-party resources, and never expose the raw capability to browser analytics. Manual revocation is not part of the primary UX; short expiry and narrow authority provide the normal lifecycle.

Browser-facing Wasp Operations and capability HTTP endpoints call the same application services for validation, optimistic revisions, compilation, and publishing. Publishing always requires the signed-in owner.

## Agent Documentation

Public, cacheable agent documentation lives at:

```text
GET /llms.txt
GET /agent/ambient-schema.md
GET /agent/api.md
GET /agent/starter.json
```

`/llms.txt` is a short discovery index. The schema Markdown contains the complete document, slot, editor-variable, customization, thumbnail, validation, and publishing contracts. The API Markdown describes the GET, modify, PUT loop and all error recovery. `starter.json` is a complete valid machine-readable document.

The temporary session bootstrap endpoint returns short Markdown containing its expiry, draft endpoint, preview URL, and links to the public documentation. It does not duplicate the schema or current document.

The browser generates one prompt for the user to paste into a coding-agent session:

```text
Create a codeshot.dev ambient for "Acme Launch".

Read and follow the instructions at this temporary agent-session URL:
https://codeshot.dev/agent/sessions/:capability

The link expires in 24 hours.
```

The prompt contains no separate token, environment-variable setup, or schema copy. The bootstrap endpoint tells the agent to read the public Markdown docs, fetch current state, replace the complete document with `baseRevision`, resolve deterministic diagnostics, and ask for a new prompt if the session expires.

## Starter And Current State

A new ambient begins with a valid minimal `AmbientDocument`, including a code slot, safe editor defaults, and a thumbnail. The preview therefore works before the first agent submission. A draft created from an existing ambient starts from its latest published version.

The agent always fetches current state before editing. A renewed session receives the same server-side draft and revision, so session expiry never loses work.

## Agent API

```text
GET  /agent/sessions/:capability
GET  /agent/sessions/:capability/draft
PUT  /agent/sessions/:capability/draft
```

The bootstrap response is Markdown optimized for a coding agent. The draft GET response contains ambient identity, revision, the complete current document, and capability-scoped preview URL. The draft PUT replaces the complete document and includes `baseRevision`:

```json
{
  "baseRevision": 3,
  "document": {
    "schemaVersion": 1,
    "name": "Acme Launch",
    "editor": {},
    "annotations": {},
    "customizations": [],
    "template": "<article>...</article>",
    "stylesheet": ":host { ... }",
    "thumbnail": {
      "template": "<div>...</div>",
      "stylesheet": ":host { ... }"
    }
  }
}
```

Valid updates increment and return the accepted revision plus `previewUrl`. Responses do not include PNG data or repeated documentation links.

Invalid documents return `422 ambient_invalid` with stable diagnostics and do not advance the accepted draft revision. Stale writes return `409 draft_revision_conflict` with the current revision and an instruction to refetch. Expired sessions return `410 agent_session_expired` with an instruction to ask the user for a new codeshot.dev agent prompt. Unknown capabilities return `404`.

## Browser Operations

Signed-in browser flows create ambients, manage temporary access, save versions, inspect history, restore drafts, and poll previews through Wasp Operations backed by the same services:

```text
createAmbient
listOwnedAmbients
getAmbientWorkspace
createAgentAccess
discardAgentAccess
getAmbientDraftRevision
getAmbientDraft
saveAmbientVersion
createDraftFromVersion
discardAmbientDraft
```

The agent capability cannot save versions, restore history, discard drafts, or manage agent access.

## Live Preview

The owner preview uses the signed-in GitHub session. The agent bootstrap and successful PUT responses link to the client route `/agent-preview/:capability`, allowing a browser-capable agent to inspect the same accepted draft without account access. Both render through the declarative runtime.

The agent preview fetches the accepted draft through the capability API and renders it with the production ambient, editor, and thumbnail components. The agent reloads the preview after an accepted update.

No dedicated live-update transport is required.

## Certification And Visibility

Deterministic validation is required to publish an immutable version. Export certification additionally runs representative browser fixtures with:

- empty and long titles
- representative file types and long identifiers
- empty, short, and long code
- line highlights and annotations
- widths of 420, 860, and 1280 px

An owner can publish and use a deterministically valid private version. Gallery visibility requires `certificationStatus: 'passed'` and an explicit owner action that updates `galleryVersion`. Certification failure never mutates the version; a fix creates a new draft revision and version. Certification does not add PNG data to agent API responses.

## Agent-First Workflow

1. Use the screenshot editor anonymously or sign in with GitHub to create an ambient.
2. Seed a valid working draft from the starter or version in use.
3. Generate a ready-to-paste prompt containing a 24-hour capability URL.
4. Have the coding agent read the bootstrap Markdown and public schema documentation.
5. Have the agent fetch the current draft and revision.
6. Have the agent submit complete replacements until deterministic validation passes.
7. Poll the accepted revision and review it in the dedicated Ambient Workspace.
8. Give visual feedback to the agent and repeat without losing the draft across renewed sessions.
9. Save an immutable private version as the signed-in owner.
10. Select the saved version under **Your ambients** in the screenshot editor.

The future visual builder and agent API operate on the same `AmbientDocument` representation.

## Customer Language

The customer directs and reviews while the coding agent authors the document. Product UI uses:

- **Ambient** with the first-use explanation “a reusable visual frame around your code”
- **Working draft** instead of document or manifest
- **Agent access** instead of capability or token
- **Latest accepted change** instead of accepted revision
- **Save version** instead of publish
- **Picker appearance** instead of thumbnail
- **Your ambients** instead of saved registry

Schema, revision, diagnostic paths, and HTTP details remain in agent documentation or collapsed technical details. A rejected update keeps the last accepted preview visible and tells the customer that the agent received required fixes.

The capability preview uses a fixed non-sensitive sample fixture. It never receives the customer’s anonymous screenshot code or restored editor state.

## Ambient Workspace UX

The screenshot editor remains anonymous and only renders included ambients or saved versions. The Ambient Library contains **Included** and **Your ambients**, with saved-version and working-draft status shown independently. Creating or opening an ambient navigates to `/ambients/:ambientId`; unfinished work never opens automatically.

The dedicated Ambient Workspace owns setup, temporary agent access, prompt handoff, draft review, saving, version history, restoration, and discard flows. Desktop uses a dominant real preview with a stable activity rail. Mobile uses accessible **Preview** and **Activity** tabs, so workspace controls never cover the screenshot editor.

Agent access and draft persistence are independent. Expired or revoked access leaves the working draft intact. Saving creates the next immutable version and marks it in use without deleting the draft. Restoring an older version creates a fresh working draft and never rewrites history.

The client retains a replaceable in-memory service for deterministic browser journeys. Mock and hosted records pass through the same compiler, registry, declarative runtime, editor, picker, and workspace presentation models.

## Assets

Schema version 1 has no uploaded assets or remote URLs. Add assets only after template, isolation, and export behavior are stable.

Future assets must be declared, content-addressed, size-limited, and served from immutable same-origin URLs. Initial candidates are raster images, sanitized SVG, and licensed WOFF2 fonts. Export must wait for every required asset.

## Testing Strategy

Automated coverage includes:

- unit tests for document, slot, customization, and CSS validation
- compiler tests proving text-only bindings and one native code slot
- compiler tests proving repeated text slots and safe tooltip reflection
- runtime tests proving CodeMirror survives ambient switches without recreation
- regression tests for customization and export-gutter behavior
- browser export tests for the representative fixtures and widths

Stage 2B adds:

- thumbnail validator and rendering tests with at least 20 miniature fixtures
- GitHub ownership and owner-only publishing integration tests
- capability hashing, expiry, ambient scoping, and log-redaction tests
- current-draft GET, valid PUT, invalid PUT, and stale revision tests
- owner and capability preview polling tests
- stable picker identity and current-version resolution tests

Vitest covers deterministic contracts. Browser-level export checks use a real browser because DOM emulation cannot certify Shadow DOM capture or PNG output.

## Delivery

### Stage 2A: Declarative Built-In

Completed:

- proved Shadow DOM, native slots, CodeMirror, annotations, and PNG export in Chromium
- implemented schema-v1 contracts, stable diagnostics, HTML compilation, and AST-based CSS validation
- compiled serializable token palettes into host-owned CodeMirror extensions
- reimplemented Swiss Poster through the bundled declarative runtime
- preserved responsive composition, customization, editing, and PNG output
- added unit, lifecycle, and real-browser export regression coverage

Swiss Poster is the tracer ambient because it exercises a title tooltip, file type, padded line-count formatting, a palette customization, responsive composition, and serializable syntax colors. A separate compiler fixture exercises repeated semantic slots.

Stage 2A accepts only bundled, trusted documents. No user or agent string reaches the declarative runtime until the hosted validation path in Stage 2B is active.

### Stage 2B: Hosted Agent Workflow

1. Research the customer journey and inventory the existing frontend constraints.
2. Integrate **Your ambients**, sign-in entry, creation, and the dedicated Ambient Workspace into the actual client.
3. Run the complete frontend against a replaceable in-memory service and real declarative runtime.
4. Validate setup, prompt handoff, review, rejection, expiry, saving, history, restoration, mobile, and accessibility before backend work.
5. Add the thumbnail contract, strict thumbnail validation, and a valid minimal starter document.
6. Select and configure GitHub authentication and full-stack Wasp deployment.
7. Add ambient, mutable draft, immutable version, and 24-hour agent-session records.
8. Publish `/llms.txt`, schema Markdown, API Markdown, and machine-readable starter JSON.
9. Replace mock service methods with Wasp Operations and capability HTTP adapters.
10. Share deterministic validation and optimistic revision services across browser and agent paths.
11. Add authenticated and capability-scoped polling previews using non-sensitive fixtures where required.
12. Add owner-only transactional private saving and version history.
13. Add **Your ambients** to the main registry, resolving each ambient to only its latest saved version.
14. Render agent-authored thumbnails only while the picker or ambient dashboard is open.
15. Cover session expiry, renewed prompts, conflicts, invalid submissions, polling, saving, and registry loading with integration tests.

This stage changes the current static-only deployment. A Wasp server, PostgreSQL database, GitHub OAuth credentials, session secrets, migrations, and production API URL become required.

### Stage 2C: Hardening And Certification

1. Add capability rate limits, log redaction verification, audit events, and abuse controls.
2. Add duplicate ambient, version inspection, rollback-by-new-version, and archive flows.
3. Add browser export certification and failure reporting without exposing PNGs through the agent API.
4. Add operational monitoring for polling load, validation latency, and failed agent sessions.
5. Prepare optional certified gallery visibility while keeping private publishing the default.

### Stage 2D: Builder And Gallery

1. Add the visual builder around the same draft representation.
2. Add richer representative fixtures and manual visual QA tools.
3. Add optional gallery discovery for certified versions.
4. Explore same-origin, content-addressed assets only after the declarative workflow is stable.

## Non-Goals

- remote executable packages
- contributed JavaScript or custom element definitions
- generic user-level padding or radius controls
- ambient-owned editor instances or extensions
- arbitrary global CSS
- uploaded assets in schema version 1
- compatibility with every HTML or CSS feature
- screenshot persistence in Stage 2
- long-lived general-purpose API tokens
- a separate token environment variable for agent sessions
- manual token revocation as a primary workflow
- WebSockets for preview updates
- PNG data in agent API responses
- dedicated fixed-width preview controls
- automatic overflow or contrast diagnostics
