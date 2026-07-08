import type { ThemeRegistrationRaw } from '@shikijs/types'

export const waspShikiTheme: ThemeRegistrationRaw = {
  name: 'wasp-light',
  type: 'light',
  fg: '#393a34',
  bg: '#f0ede6',
  colors: {
    'editor.background': '#f0ede6',
    'editor.foreground': '#393a34',
    'editor.selectionBackground': '#fff3cc',
    'editor.lineHighlightBackground': '#fff3cc66',
  },
  settings: [
    {
      scope: ['comment', 'punctuation.definition.comment', 'string.comment'],
      settings: { foreground: '#999999', fontStyle: 'italic' },
    },
    {
      scope: ['string', 'constant.other.symbol', 'constant.character', 'markup.heading'],
      settings: { foreground: '#777777' },
    },
    {
      scope: ['punctuation', 'keyword.operator', 'storage.modifier'],
      settings: { foreground: '#555555' },
    },
    {
      scope: [
        'constant',
        'constant.numeric',
        'constant.language',
        'variable',
        'variable.other',
        'support.constant',
        'support.variable',
        'meta.object-literal.key',
      ],
      settings: { foreground: '#333333' },
    },
    {
      scope: [
        'keyword',
        'storage',
        'entity.name.tag',
        'entity.other.attribute-name',
        'support.type.property-name',
        'meta.selector',
      ],
      settings: { foreground: '#b8941f', fontStyle: 'bold' },
    },
    {
      scope: [
        'entity.name.function',
        'support.function',
        'entity.name.type',
        'support.class',
        'support.type',
      ],
      settings: { foreground: '#333333', fontStyle: 'bold' },
    },
    {
      scope: ['markup.bold'],
      settings: { fontStyle: 'bold' },
    },
    {
      scope: ['markup.italic'],
      settings: { fontStyle: 'italic' },
    },
  ],
}
