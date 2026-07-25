// A new theme opens with a name already in place, so the first screen never asks for typing.
const adjectives = [
  'amber', 'brisk', 'candid', 'dusty', 'even', 'faded', 'gentle', 'humble',
  'inky', 'keen', 'level', 'muted', 'northern', 'opal', 'plain', 'quiet',
  'rustic', 'slate', 'tidy', 'umber', 'vivid', 'warm', 'yellow', 'zinc',
] as const

const nouns = [
  'anchor', 'basalt', 'cinder', 'drift', 'ember', 'field', 'grain', 'harbor',
  'ivory', 'juniper', 'kiln', 'lantern', 'meadow', 'notch', 'orchard', 'pebble',
  'quarry', 'ridge', 'thistle', 'undertow', 'vellum', 'willow',
] as const

const pick = <Value>(values: readonly Value[]) =>
  values[Math.floor(Math.random() * values.length)]!

export const randomThemeName = () => `${pick(adjectives)} ${pick(nouns)}`
