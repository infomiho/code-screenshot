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

Built-in shells are currently trusted React components. Presentation still depends on ambient-specific frame classes and CSS selectors that reach into `.cm-*` internals. Export-only gutter behavior also lives outside the manifest. Stage 2A replaces those boundaries for one built-in before accepting mutable definitions.

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

Stage 2A migrates the current `AmbientManifest` toward this document/envelope split. It also renames the token palette's current `muted` field to the semantic `comment` field before schema version 1 is persisted.

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

## Export Feasibility Gate

Before freezing schema version 1, Stage 2A must prove that `modern-screenshot` correctly captures:

- an open shadow root
- the slotted CodeMirror host and syntax colors
- line highlights and export-only gutter behavior
- ambient custom properties
- empty and long semantic text
- annotations layered above the shell
- required fonts at fixed dimensions

Test widths are 420, 860, and 1280 px. If the current exporter cannot reliably clone open shadow roots and slotted content, Stage 2A must choose and document a scoped light-DOM fallback before implementing persistence. Persistence cannot begin with an unresolved rendering boundary.

Export freezes interactive state, waits for fonts and images, and captures explicit dimensions. Closed roots, opaque iframes, canvas-dependent visuals, and cross-origin resources remain unsupported.

## Stored Model

```ts
type AmbientRecord = {
  id: string
  ownerId: string
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
```

`AmbientDraftRecord.ambientId` is unique. `(ambientId, version)` uniquely identifies an immutable version. Publishing runs in a transaction:

1. authorize the principal against the ambient
2. compare the submitted base revision with the current draft revision
3. rerun deterministic validation
4. create the next immutable version
5. update `currentVersion`, status, and denormalized name

The draft remains available for subsequent edits. The record's name is denormalized for listings and kept in sync on draft writes and publishing. `galleryVersion` may reference only a certified version and can differ from `currentVersion`, allowing a new private version without removing the previous gallery version. Future saved screenshots or presets must reference an exact ambient ID and version. Screenshot persistence itself is not part of Stage 2.

## Ownership And Agents

Stage 2C introduces an authenticated principal shared by browser and agent flows. Browser-facing Wasp Operations and HTTP agent endpoints call the same application services for authorization, validation, draft updates, and publishing.

Agent credentials are hashed, revocable tokens associated with a user and explicit ambient read/write scopes. Authentication mechanism and server deployment must be selected before Stage 2C begins; `ownerId` and `createdBy` cannot ship as unauthenticated caller input.

## Agent API

```text
POST  /api/ambients
GET   /api/ambients/:id
PUT   /api/ambients/:id/draft
POST  /api/ambients/:id/draft/validate
POST  /api/ambients/:id/draft/preview
POST  /api/ambients/:id/publish
GET   /api/ambients/:id/versions/:version
```

Draft updates replace the complete document and include `baseRevision`. A stale revision returns a conflict instead of silently merging nested template data.

Validation returns diagnostics. Preview returns diagnostics plus an authenticated browser preview reference for the exact draft revision. The server validates and stores declarative data; rendering occurs in the browser, and submitted JavaScript is never accepted. Publishing is the only operation that creates an immutable version, so there is no separate version-creation endpoint.

## Certification And Visibility

Deterministic validation is required to publish an immutable version. Export certification additionally runs representative browser fixtures with:

- empty and long titles
- representative file types and long identifiers
- empty, short, and long code
- line highlights and annotations
- widths of 420, 860, and 1280 px

An owner can use a valid private version. Gallery visibility requires `certificationStatus: 'passed'` and an explicit owner action that updates `galleryVersion`. Certification failure never mutates the version; a fix creates a new draft revision and version.

## Builder Workflow

1. Create or open a draft.
2. Edit template, stylesheet, token palette, semantic bindings, and customization slots.
3. Validate continuously with stable diagnostics.
4. Preview representative content at 420, 860, and 1280 px.
5. Save the full draft using its base revision.
6. Publish an immutable private version.
7. Run export certification before optional gallery visibility.

The visual editor and agent API operate on the same `AmbientDocument` representation.

## Assets

Schema version 1 has no uploaded assets or remote URLs. Add assets only after template, isolation, and export behavior are stable.

Future assets must be declared, content-addressed, size-limited, and served from immutable same-origin URLs. Initial candidates are raster images, sanitized SVG, and licensed WOFF2 fonts. Export must wait for every required asset.

## Testing Strategy

Stage 2 adds the currently missing automated test boundary:

- unit tests for document, slot, customization, and CSS validation
- compiler tests proving text-only bindings and one native code slot
- compiler tests proving repeated text slots and safe tooltip reflection
- runtime tests proving CodeMirror survives ambient switches without recreation
- regression tests for customization and export-gutter behavior
- browser export tests for the representative fixtures and widths

Vitest covers deterministic contracts. Browser-level export checks use a real browser because DOM emulation cannot certify Shadow DOM capture or PNG output.

## Delivery

### Stage 2A: Declarative Built-In

1. Run the Shadow DOM export feasibility gate.
2. Finalize schema version 1, diagnostic codes, and documented editor variables.
3. Implement the minimum document validator and template compiler.
4. Compile serializable token palettes into host-owned CodeMirror extensions.
5. Reimplement Swiss Poster through the declarative runtime while keeping its document bundled.
6. Preserve its composition, responsive behavior, customization, editing, and PNG output.
7. Add unit and browser regression tests.

Swiss Poster is the tracer ambient because it exercises a title tooltip, file type, padded line-count formatting, a palette customization, responsive composition, and serializable syntax colors. A separate compiler fixture exercises repeated semantic slots.

Stage 2A accepts only bundled, trusted documents. No user or agent string reaches the declarative runtime until the complete untrusted-input validation path in Stage 2B is active.

### Stage 2B: Local Draft Runtime

1. Add strict AST-based CSS validation and complexity limits.
2. Add local mutable draft editing and diagnostics.
3. Preview representative fixtures and widths in the browser.
4. Verify switching between built-in React shells and declarative shells.
5. Keep all draft data local; no server or database is required yet.

### Stage 2C: Persistence And API

1. Select and configure Wasp authentication and full-stack deployment.
2. Add ambient, draft, immutable version, owner, and agent-token records.
3. Implement shared application services, Wasp Operations, and HTTP adapters.
4. Add optimistic draft revisions and transactional publishing.
5. Load exact saved versions into the ambient registry.

This stage changes the current static-only deployment: a Wasp server, PostgreSQL database, secrets, migrations, and API URL become production requirements.

### Stage 2D: Builder And Certification

1. Add the visual builder around the same draft representation.
2. Add representative fixtures and responsive preview controls.
3. Add the browser export certification runner and result reporting.
4. Add optional gallery visibility for certified versions.

## Non-Goals

- remote executable packages
- contributed JavaScript or custom element definitions
- generic user-level padding or radius controls
- ambient-owned editor instances or extensions
- arbitrary global CSS
- uploaded assets in schema version 1
- compatibility with every HTML or CSS feature
- screenshot persistence in Stage 2
