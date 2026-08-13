export const plausibleEventNames = [
  'Screenshot Copied',
  'Screenshot Downloaded',
  'Ambient Created',
  'Ambient Version Saved',
  'Ambient Sharing Enabled',
  'Share Link Copied',
  'Shared Ambient Viewed',
  'Agent Prompt Copied',
] as const

export type PlausibleEventName = typeof plausibleEventNames[number]
