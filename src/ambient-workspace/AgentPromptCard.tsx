const buildAgentPrompt = (ambientName: string, agentAccessUrl: string, hasSavedVersion: boolean) => {
  const intro = hasSavedVersion
    ? `Update the codeshot.dev ambient "${ambientName}".`
    : `Create a codeshot.dev ambient for "${ambientName}".`
  const direction = hasSavedVersion
    ? 'The draft holds the current design. Ask me what should change.'
    : 'Ask me for the visual direction.'

  return `${intro}

Open this temporary session with an HTTP or web-fetch tool. Read both linked references and fetch the current draft:
${agentAccessUrl}

${direction} Do not update the draft until I answer.
`
}

type AgentPromptCardProps = {
  agentAccessUrl: string
  ambientName: string
  hasSavedVersion: boolean
  isPrimary?: boolean
  onCopied: () => void
  onStatus: (message: string) => void
}

export function AgentPromptCard({
  agentAccessUrl,
  ambientName,
  hasSavedVersion,
  isPrimary = false,
  onCopied,
  onStatus,
}: AgentPromptCardProps) {
  const prompt = buildAgentPrompt(ambientName, agentAccessUrl, hasSavedVersion)

  const copyPrompt = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(prompt)
      onCopied()
      onStatus('Agent prompt copied. Waiting for agent changes.')
    } catch {
      onStatus('Could not copy the agent prompt. Select the prompt and copy it manually.')
    }
  }

  return (
    <section className="workspace-card workspace-prompt-card" aria-labelledby="agent-prompt-heading">
      <span className="workspace-eyebrow">{isPrimary ? 'Next step' : 'Continue with agent'}</span>
      <h2 id="agent-prompt-heading">Agent prompt</h2>
      <button className="ui-button ui-button-primary" type="button" onClick={copyPrompt}>
        Copy prompt
      </button>
      <details className="workspace-prompt-disclosure">
        <summary>Show prompt</summary>
        <pre tabIndex={0}>{prompt}</pre>
      </details>
    </section>
  )
}
