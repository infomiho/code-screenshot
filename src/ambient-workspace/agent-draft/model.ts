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

${model.designDirection ? `Design direction: ${model.designDirection}\n\n` : ''}Read and follow the instructions at this temporary URL:
https://codeshot.dev/agent/sessions/cap_demo_7c92f

This link can only read and update this ambient draft.
It expires ${formatExpiry(model.promptExpiresAt)}.`
