import { z } from 'zod'
import type { DocRule, DocumentSpec } from '@infomiho/agent-work-protocol'
import { compileAmbientDocument } from './compiler'
import type { AmbientDocument } from './schema'

export const ambientDocumentSpec: DocumentSpec<AmbientDocument> = createAmbientDocumentSpec()

function createAmbientDocumentSpec(): DocumentSpec<AmbientDocument> {
  const schema = ambientDocumentSchema()
  return {
    name: 'ambient document',
    schema,
    jsonSchema: z.toJSONSchema(schema),
    rules: documentRules(),
    validate: (input) => {
      const result = compileAmbientDocument(input)
      return result.compiled
        ? { document: result.compiled.document, diagnostics: result.diagnostics }
        : { document: null, diagnostics: result.diagnostics }
    },
  }
}

// Must never reject a document the compiler accepts: keys are strict (so is
// the compiler), every value type stays looser.
function ambientDocumentSchema() {
  const tokenPalette = z.strictObject({
    text: z.string(),
    comment: z.string(),
    string: z.string(),
    keyword: z.string(),
    number: z.string(),
    function: z.string(),
    type: z.string(),
    punctuation: z.string(),
  })

  const paletteSlot = z.strictObject({
    type: z.literal('palette'),
    id: z.string(),
    label: z.string(),
    cssVariable: z.string(),
    valueKind: z.enum(['color', 'paint']),
    defaultOptionId: z.string(),
    options: z.array(z.strictObject({
      id: z.string(),
      label: z.string(),
      value: z.string(),
    })),
  })

  const colorSlot = z.strictObject({
    type: z.literal('color'),
    id: z.string(),
    label: z.string(),
    cssVariable: z.string(),
    defaultValue: z.string(),
  })

  return z.strictObject({
    schemaVersion: z.literal(1),
    name: z.string(),
    editor: z.strictObject({
      tokens: tokenPalette,
      exportGutter: z.enum(['show', 'hide']),
    }),
    annotations: z.strictObject({ ink: z.string() }),
    customizations: z.array(z.discriminatedUnion('type', [paletteSlot, colorSlot])),
    template: z.string(),
    stylesheet: z.string(),
    thumbnail: z.strictObject({
      template: z.string(),
      stylesheet: z.string(),
    }),
  })
}

function documentRules(): DocRule[] {
  return [
    {
      code: 'document',
      title: 'Document structure and size',
      description: `An ambient is declarative JSON containing presentation data only. Scripts, event handlers, network resources, imports, and executable packages are not allowed. All fields shown in the JSON Schema are required. The complete document must stay under 192 KiB, the template under 64 KiB, and the stylesheet under 96 KiB.

\`editor.tokens\` is the syntax highlighting palette for the rendered code. Each entry colors one token group with a literal CSS color: \`keyword\` also covers operators and booleans, \`text\` covers plain identifiers, and \`punctuation\` covers brackets and delimiters. Give the groups clearly distinguishable colors that read against the editor background.`,
    },
    {
      code: 'template',
      title: 'Template subset',
      description: `- Use exactly one root element and exactly one \`<ambient-slot name="code"></ambient-slot>\`.
- Allowed elements are \`article\`, \`div\`, \`footer\`, \`h2\`, \`header\`, \`section\`, and \`span\`.
- Regular elements accept only a kebab-case \`class\` attribute. IDs, ARIA attributes, inline styles, links, images, and data attributes are rejected.
- Add dynamic text with \`<ambient-slot name="title"></ambient-slot>\`. Other text sources are \`fileTypeId\`, \`fileTypeLabel\`, and \`lineCount\`.
- Text slots may use \`format="plain"\`, or \`format="pad-3"\` for \`lineCount\`, plus optional \`fallback\` and \`tooltip\` attributes.`,
    },
    {
      code: 'stylesheet',
      title: 'Stylesheet subset',
      description: `Stylesheets are scoped to the ambient. Use \`:host\` as the root selector and \`::slotted([slot=code])\` for the code editor. \`@import\`, \`@font-face\`, \`@keyframes\`, \`!important\`, remote URLs, SVG data URLs, scriptable values, and selectors that escape the ambient are rejected. Base64 \`data:image/png\` and \`data:image/jpeg\` URLs are allowed when the decoded image is at most 48 KiB, each dimension is at most 2048 px, and the image is at most 4 megapixels.

The \`::slotted([slot='code'])\` rule may contain only the supported editor variables; put ordinary CSS declarations on a surrounding template element. Color variables (\`--ambient-editor-background\`, \`-caret-color\`, \`-gutter-color\`, \`-highlight-accent\`, \`-highlight-background\`, \`-selected-line-number-color\`, \`-selection-background\`, \`-text-color\`) require literal CSS colors, not \`var(...)\` indirection. Non-color variables (\`--ambient-editor-content-padding-inline\`, \`-font-family\`, \`-font-size\`, \`-font-weight\`, \`-gutter-gap\`, \`-gutter-padding-inline-end\`, \`-line-height\`) use literal values; lengths must use \`px\`. The caret falls back to \`--ambient-editor-text-color\`; set \`--ambient-editor-caret-color\` to a color that contrasts with the editor background.`,
    },
    {
      code: 'customization',
      title: 'Customizations',
      description: `Every customization requires \`type\`, \`id\`, \`label\`, and \`cssVariable\`. IDs use lowercase kebab-case. CSS variables start with \`--ambient-\` and must be both declared in the stylesheet and used by it. Prefer \`palette\` customizations with 3 to 6 named, designed options; add a free \`color\` customization only when arbitrary colors genuinely suit the design. Color variables work in color-bearing properties such as \`color\`, \`background\`, \`border\`, \`box-shadow\`, \`fill\`, and \`stroke\`. Paint palettes work only in \`background\` and \`background-image\`.`,
    },
    {
      code: 'schema',
      title: 'Schema version',
      description: 'Only `schemaVersion: 1` is supported.',
    },
    {
      code: 'value',
      title: 'Field values',
      description: 'Color fields require literal CSS colors, not `var(...)` indirection. IDs use lowercase kebab-case. `defaultOptionId` must reference an existing option, and palette option values must match the palette\'s `valueKind`.',
    },
    {
      code: 'thumbnail',
      title: 'Thumbnail subset',
      description: `A dedicated miniature shown in the picker, independent from the screenshot template. No slots or dynamic content.

- Use one root with only \`div\`, \`span\`, and \`i\` elements, kebab-case \`class\` attributes, and no text.
- Keep the template under 2 KiB, at most 24 elements, and at most 6 levels deep; keep CSS under 4 KiB and use percentages or host-relative layout.
- Remote URLs, animations, transitions, CSS resets, fixed or sticky positioning, and pointer events are rejected.
- \`:host\` is the only allowed pseudo-class. Pseudo-elements and selectors such as \`:nth-child()\` are rejected; use distinct classes instead.`,
    },
  ]
}
