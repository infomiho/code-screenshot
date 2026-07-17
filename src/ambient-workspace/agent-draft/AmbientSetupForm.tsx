import { useState } from 'react'
import { AgentButton } from './AgentButton'

type AmbientSetupFormProps = {
  onCreateAmbient: (ambientName: string, designDirection: string) => void
}

export function AmbientSetupForm({ onCreateAmbient }: AmbientSetupFormProps) {
  const [ambientName, setAmbientName] = useState('')
  const [designDirection, setDesignDirection] = useState('')

  return (
    <form
      className="agent-setup-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (ambientName.trim()) onCreateAmbient(ambientName.trim(), designDirection.trim())
      }}
    >
      <div className="agent-copy">
        <h3>Describe the ambient</h3>
        <p>Your agent will use these details to create it.</p>
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
      <label>
        <span>Design direction <small>Optional</small></span>
        <textarea
          value={designDirection}
          placeholder="Editorial, high contrast, compact labels."
          onChange={(event) => setDesignDirection(event.currentTarget.value)}
        />
      </label>
      <AgentButton variant="primary" type="submit" isDisabled={!ambientName.trim()}>
        Create prompt
      </AgentButton>
    </form>
  )
}
