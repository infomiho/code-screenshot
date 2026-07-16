# Saved Ambients

## Goal

Let people and agents create branded ambient shells, preview them with a live app-owned code editor, and save immutable versions in the database. Ambient definitions are declarative data, not executable application code.

## Mental Model

Screenshot content is portable between ambients:

- title
- file type and syntax
- source code
- derived line count

An ambient owns its design:

- HTML composition
- CSS and typography
- padding, radius, and geometry
- decorative chrome and fixed copy
- syntax palette

An ambient may declare narrow semantic customization slots. Examples include a macOS desktop backdrop or Swiss poster ground. Generic geometry controls are not part of the model.

## Stage 1 Contract

Built-in ambients use a source-agnostic registry, serializable manifests, shared semantic content, and declared customization slots. Their shells remain trusted Preact components for now.

The application owns CodeMirror, editing behavior, line highlighting, annotations, resizing, and export. An ambient receives the editor host as content but cannot initialize or replace it.

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

type AmbientManifest = {
  schemaVersion: 1
  id: string
  version: number
  name: string
  editor: {
    tokens: AmbientTokenPalette
  }
  customizations: AmbientCustomizationSlot[]
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

## Stored Model

```ts
type AmbientRecord = {
  id: string
  ownerId: string
  name: string
  status: 'draft' | 'published' | 'archived'
  currentVersion: number
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
  createdAt: Date
}
```

Published versions are immutable. Screenshots reference an exact ambient ID and version so old output remains reproducible. Drafts remain mutable until published.

## Declarative Shell

Saved ambients use inert HTML with host-defined slots:

```html
<article class="shell">
  <header>
    <ambient-slot name="title"></ambient-slot>
    <ambient-slot name="fileType"></ambient-slot>
  </header>
  <section class="code">
    <ambient-slot name="code"></ambient-slot>
  </section>
  <footer>
    <ambient-slot name="lineCount"></ambient-slot>
  </footer>
</article>
```

Exactly one `code` slot is required. Text bindings use `textContent`; bindings never accept HTML. Static mood copy remains in the template. The host inserts its existing CodeMirror element into the code slot.

Supported semantic sources in schema version 1:

- `title`
- `fileTypeId`
- `fileTypeLabel`
- `lineCount`

Formatting is selected from a host-owned vocabulary such as plain text and zero-padded integers.

## Customizations

Customization controls are declared by the ambient and rendered by the host.

```ts
type AmbientCustomizationSlot = {
  type: 'palette'
  id: string
  label: string
  cssVariable: `--ambient-${string}`
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

Prefer curated palettes. Palette overrides store option IDs rather than raw CSS, and the host validates and resolves them to declared values. Arbitrary colors are allowed only when the ambient was designed to maintain contrast for them. Overrides are keyed by ambient ID and version, then applied as CSS variables at the shell root.

## Agent API

```text
POST   /api/ambients
GET    /api/ambients/:id
PATCH  /api/ambients/:id/draft
POST   /api/ambients/:id/preview
POST   /api/ambients/:id/versions
POST   /api/ambients/:id/publish
GET    /api/ambients/:id/versions/:version
```

Agents submit manifest, template, and stylesheet data. Preview returns validation diagnostics and a renderable draft reference. Publishing creates a new immutable version.

## Builder Workflow

1. Create or open a draft.
2. Edit template, stylesheet, token palette, semantic bindings, and customization slots.
3. Preview against representative code at 420, 860, and 1280 px.
4. Report unsupported HTML or CSS, missing slots, contrast failures, overflow, and export errors.
5. Save the draft or publish a version.
6. Make published versions available to a user, workspace, or gallery.

The visual editor and agent API operate on the same draft representation.

## Validation

HTML is parsed with an allowlist. Reject scripts, event handlers, inline styles, forms, navigation, iframes, objects, media, canvas, and arbitrary URL attributes.

CSS is parsed with an AST. Reject imports, remote URLs, global selectors, fixed overlays, selectors targeting application UI, and animation required for final output. Bound expensive effects and generated content.

Validation protects against both hostile input and malformed agent-generated definitions. Authentication and ownership do not replace validation.

## Isolation

Saved shells render in an open Shadow DOM. Their CSS remains isolated while the app-owned CodeMirror host is assigned to the code slot. Open roots remain inspectable and exportable.

Saved ambients never provide JavaScript, custom elements, CodeMirror extensions, or arbitrary HTML bindings. They cannot inspect, serialize, initialize, or replace the editor.

## Editor Contract

The host converts a serializable token palette into its own CodeMirror highlight extension. Ambient CSS styles the editor only through documented variables such as code font, size, line height, ink, gutter ink, highlight background, and selection background.

Saved CSS must not depend on undocumented `.cm-*` structure.

## Assets

Start without uploaded assets. Add them only after template and export behavior is stable.

Future assets must be declared, content-addressed, size-limited, and served from immutable same-origin URLs. Initial supported types should be raster images, sanitized SVG, and licensed WOFF2 fonts. Export waits for required fonts and images.

## Rendering And Export

The capture root, editor, and shell remain in one same-document tree. Export freezes transitions, waits for fonts and images, and captures fixed dimensions. Closed shadow roots, opaque iframes, canvas-dependent visuals, and cross-origin resources are unsupported.

Every published version must pass export certification with empty and long titles, representative file types, long identifiers, highlights, and widths of 420, 860, and 1280 px.

## Delivery

### Stage 2A: Declarative Built-In

Build the minimum manifest validator and template compiler, then reimplement one built-in ambient through that path while keeping its files bundled. Compile its serializable token palette into a host-owned CodeMirror extension. Validate slots, Shadow DOM, customization variables, editor ownership, and export.

### Stage 2B: Draft Runtime

Extend validation and compilation for mutable drafts, then add CSS validation, draft preview, diagnostics, and local draft editing.

### Stage 2C: Persistence And API

Add database records, immutable versions, ownership, agent endpoints, and ambient selection from the registry.

### Stage 2D: Builder

Add the visual editor, representative fixtures, responsive previews, publishing workflow, and optional gallery visibility.

## Non-Goals

- remote executable packages
- contributed JavaScript
- generic padding or radius controls
- ambient-owned editor instances
- arbitrary global CSS
- compatibility with every CSS feature
