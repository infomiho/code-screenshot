import { useState } from 'react'
import { AgentButton } from './AgentButton'

type AmbientSetupFormProps = {
  onCreateAmbient: (ambientName: string) => void
}

export function AmbientSetupForm({ onCreateAmbient }: AmbientSetupFormProps) {
  const [ambientName, setAmbientName] = useState('')

  return (
    <form
      className="agent-setup-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (ambientName.trim()) onCreateAmbient(ambientName.trim())
      }}
    >
      <div className="agent-copy">
        <h3>Name the ambient</h3>
        <p>Your agent will ask you for the visual direction.</p>
      </div>
      <label>
        <span>Ambient name</span>
        <input
          data-dock-focus
          required
          value={ambientName}
          placeholder="Launch editorial"
          onChange={(event) => setAmbientName(event.currentTarget.value)}
        />
      </label>
      <AgentButton variant="primary" type="submit" isDisabled={!ambientName.trim()}>
        Create agent prompt
      </AgentButton>
    </form>
  )
}
