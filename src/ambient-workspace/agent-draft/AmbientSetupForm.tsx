import { useState } from 'react'
import { AgentButton } from './AgentButton'

type AmbientSetupFormProps = {
  isCreating: boolean
  onCreateAmbient: (ambientName: string) => void
}

export function AmbientSetupForm({ isCreating, onCreateAmbient }: AmbientSetupFormProps) {
  const [ambientName, setAmbientName] = useState('')

  return (
    <form
      className="agent-setup-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (!isCreating && ambientName.trim()) onCreateAmbient(ambientName.trim())
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
          disabled={isCreating}
          required
          value={ambientName}
          placeholder="Launch editorial"
          onChange={(event) => setAmbientName(event.currentTarget.value)}
        />
      </label>
      <AgentButton variant="primary" type="submit" isDisabled={isCreating || !ambientName.trim()}>
        {isCreating ? 'Creating...' : 'Create agent prompt'}
      </AgentButton>
    </form>
  )
}
