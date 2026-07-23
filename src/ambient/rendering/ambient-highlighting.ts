import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import type { AmbientTokenPalette } from '../schema'

const createHighlightStyle = (colors: AmbientTokenPalette) =>
  HighlightStyle.define([
    { tag: tags.comment, color: colors.comment, fontStyle: 'italic' },
    { tag: [tags.string, tags.character, tags.heading, tags.regexp], color: colors.string },
    {
      tag: [tags.keyword, tags.atom, tags.bool, tags.operator, tags.modifier, tags.definitionKeyword],
      color: colors.keyword,
    },
    { tag: [tags.number, tags.variableName, tags.constant(tags.name)], color: colors.number },
    {
      tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
      color: colors.function,
      fontWeight: '700',
    },
    {
      tag: [tags.className, tags.typeName, tags.tagName, tags.attributeName],
      color: colors.type,
    },
    { tag: [tags.punctuation, tags.propertyName], color: colors.punctuation },
    { tag: tags.name, color: colors.text },
    { tag: tags.strong, fontWeight: '700' },
    { tag: tags.emphasis, fontStyle: 'italic' },
  ])

export const createAmbientEditorExtension = (colors: AmbientTokenPalette) =>
  syntaxHighlighting(createHighlightStyle(colors))
