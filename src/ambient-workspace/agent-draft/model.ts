import type { AgentDraftModel } from '../ambient-workspace-service'

export const formatExpiry = (value: string | null) => value
  ? new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  : ''

export const getHudStatus = (model: AgentDraftModel) => {
  if (model.notice === 'offline') return 'Offline'
  if (model.notice === 'expired') return 'Access expired'
  if (model.notice === 'unavailable') return 'New link required'
  if (model.notice === 'request-error') return 'Request failed'
  if (model.notice === 'rejected') return 'Update rejected'

  switch (model.phase) {
    case 'setup':
      return 'Describe a new ambient'
    case 'handoff':
      return model.promptCopied ? 'Waiting for agent changes' : 'Prompt ready'
    case 'review':
      return 'Ready to review'
    case 'saved':
      return 'Private version saved'
  }
}

export const getPrompt = (model: AgentDraftModel) => `Create a codeshot.dev ambient for “${model.ambientName}”.

Open this temporary session with an HTTP or web-fetch tool. Read both linked references and fetch the current draft:
${model.agentSessionUrl ?? ''}

Ask me for the visual direction. Do not update the draft until I answer.
`
