# Ambient document schema

An ambient is declarative JSON containing presentation data only. Scripts, event handlers, network resources, imports, and executable packages are not allowed. Bounded base64 PNG and JPEG images are the only asset exception.

```ts
type AmbientDocument = {
  schemaVersion: 1
  name: string
  editor: {
    tokens: {
      text: string
      comment: string
      string: string
      keyword: string
      number: string
      function: string
      type: string
      punctuation: string
    }
    exportGutter: 'show' | 'hide'
  }
  annotations: { ink: string }
  customizations: Array<PaletteCustomization | ColorCustomization>
  template: string
  stylesheet: string
  thumbnail: {
    template: string
    stylesheet: string
  }
}
```

## Editor tokens

`editor.tokens` is the syntax highlighting palette for the rendered code. Each entry colors one token group with a literal CSS color: `keyword` also covers operators and booleans, `text` covers plain identifiers, and `punctuation` covers brackets and delimiters. Give the groups clearly distinguishable colors that read against the editor background; the starting draft ships a near-grayscale ramp with a single accent that you should replace with the ambient's own palette.

## Template subset

- Use exactly one root element and exactly one `<ambient-slot name="code"></ambient-slot>`.
- Allowed elements are `article`, `div`, `footer`, `h2`, `header`, `section`, and `span`.
- Regular elements accept only a kebab-case `class` attribute. IDs, ARIA attributes, inline styles, links, images, and data attributes are rejected.
- Add dynamic text with `<ambient-slot name="title"></ambient-slot>`. Other text sources are `fileTypeId`, `fileTypeLabel`, and `lineCount`.
- Text slots may use `format="plain"`, or `format="pad-3"` for `lineCount`, plus optional `fallback` and `tooltip` attributes.

## Editor styling

The exact `::slotted([slot='code'])` rule may contain only the supported editor variables below. Put ordinary CSS declarations on a surrounding template element. Color variables require literal CSS colors, not `var(...)` indirection.

Supported color variables:

- `--ambient-editor-background`
- `--ambient-editor-caret-color`
- `--ambient-editor-gutter-color`
- `--ambient-editor-highlight-accent`
- `--ambient-editor-highlight-background`
- `--ambient-editor-selected-line-number-color`
- `--ambient-editor-selection-background`
- `--ambient-editor-text-color`

Supported non-color variables:

- `--ambient-editor-content-padding-inline`
- `--ambient-editor-font-family`
- `--ambient-editor-font-size`
- `--ambient-editor-font-weight`
- `--ambient-editor-gutter-gap`
- `--ambient-editor-gutter-padding-inline-end`
- `--ambient-editor-line-height`

Use literal values; lengths must use `px`.

## Customizations

Every customization requires `type`, `id`, `label`, and `cssVariable`. IDs use lowercase kebab-case. CSS variables start with `--ambient-`.

```ts
type ColorCustomization = {
  type: 'color'
  id: string
  label: string
  cssVariable: `--ambient-${string}`
  defaultValue: string
}

type PaletteCustomization = {
  type: 'palette'
  id: string
  label: string
  cssVariable: `--ambient-${string}`
  valueKind: 'color' | 'paint'
  defaultOptionId: string
  options: Array<{ id: string; label: string; value: string }>
}
```

Color variables work in color-bearing properties such as `color`, `background`, `border`, `box-shadow`, `fill`, and `stroke`. Paint palettes work only in `background` and `background-image`.

Stylesheets are scoped to the ambient. Use `:host` as the root selector and `::slotted([slot=code])` for the code editor. Remote URLs, SVG data URLs, `@import`, scriptable values, and selectors that escape the ambient are rejected.

## Thumbnail

Create a dedicated miniature that represents the ambient in the picker. It is independent from the full screenshot template and cannot use slots or dynamic content.

- Use one root with only `div`, `span`, and `i` elements.
- Use only kebab-case `class` attributes and no text.
- Keep the template under 2 KiB, at most 24 elements, and at most 6 levels deep.
- Keep CSS under 4 KiB and use percentages or host-relative layout.
- Remote URLs, animations, transitions, CSS resets, fixed or sticky positioning, and pointer events are rejected.
- `:host` is the only allowed pseudo-class. Pseudo-elements and selectors such as `:nth-child()` are rejected; use distinct classes instead.

The complete JSON document must stay under 192 KiB. Remote URLs and SVG data URLs are rejected. Stylesheets may use base64 `data:image/png` and `data:image/jpeg` URLs when the decoded image is at most 48 KiB, each dimension is at most 2048 px, and the image is at most 4 megapixels.

A rejected PUT does not advance the revision. Fix every diagnostic and resubmit from the latest accepted revision.
