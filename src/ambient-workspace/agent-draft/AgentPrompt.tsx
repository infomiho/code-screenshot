import type { AgentDraftModel } from '../ambient-workspace-service'
import { AgentButton } from './AgentButton'
import { getPrompt } from './model'

type AgentPromptProps = {
  copyLabel: string
  isDisabled: boolean
  model: AgentDraftModel
  onCopyPrompt: () => void
}

export function AgentPrompt({ copyLabel, isDisabled, model, onCopyPrompt }: AgentPromptProps) {
  return (
    <section className="agent-prompt" aria-labelledby="agent-prompt-title">
      <h3 id="agent-prompt-title">Ready-to-paste prompt</h3>
      <pre tabIndex={0}>{getPrompt(model)}</pre>
      <AgentButton
        variant="primary"
        isDisabled={isDisabled}
        onClick={onCopyPrompt}
      >
        {copyLabel}
      </AgentButton>
    </section>
  )
}
