# Ambient document schema

An ambient is declarative JSON containing presentation data only. Scripts, event handlers, external resources, imports, and executable packages are not allowed.

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

Customization CSS variables must start with `--ambient-`. Palette options provide fixed values; color customizations provide a default color.

Stylesheets are scoped to the ambient. Use `:host` as the root selector and `::slotted([slot=code])` for the code editor. Network URLs, `@import`, scriptable values, and selectors that escape the ambient are rejected.

## Thumbnail

Create a dedicated miniature that represents the ambient in the picker. It is independent from the full screenshot template and cannot use slots or dynamic content.

- Use one root with only `div`, `span`, and `i` elements.
- Use only kebab-case `class` attributes and no text.
- Keep the template under 2 KiB, at most 24 elements, and at most 6 levels deep.
- Keep CSS under 4 KiB and use percentages or host-relative layout.
- URLs, assets, animations, transitions, CSS resets, fixed or sticky positioning, and pointer events are rejected.

A rejected PUT does not advance the revision. Fix every diagnostic and resubmit from the latest accepted revision.
