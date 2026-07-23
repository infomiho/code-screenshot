import { useRef, useState, type FormEvent } from 'react'
import { AmbientWorkspaceHeader } from './AmbientWorkspaceHeader'
import type { AmbientAccountDto } from './contracts'

type WorkspaceSetupStateProps = {
  account: AmbientAccountDto
  draftCount: number
  onCancel: () => void
  onCreate: (ambientName: string) => Promise<boolean>
  onSignIn: () => void
  onSignOut: () => void
}

export function WorkspaceSetupState({
  account,
  draftCount,
  onCancel,
  onCreate,
  onSignIn,
  onSignOut,
}: WorkspaceSetupStateProps) {
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [ambientName, setAmbientName] = useState('')
  const [formError, setFormError] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const createAmbient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = ambientName.trim()
    if (!name) {
      setFormError('Enter a name for this ambient.')
      nameInputRef.current?.focus()
      return
    }

    setFormError('')
    setIsCreating(true)
    const created = await onCreate(name)
    setIsCreating(false)
    if (!created) {
      setFormError('Could not create this ambient. Try again.')
    }
  }

  return (
    <main className="ambient-workspace-page">
      <h1 className="sr-only">Create ambient</h1>
      <AmbientWorkspaceHeader
        account={account}
        draftCount={draftCount}
        onClose={onCancel}
        onSignOut={onSignOut}
      />
      <div className="workspace-layout">
        <section className="workspace-preview-panel workspace-setup-panel">
          <div className="workspace-setup-card">
            <span className="workspace-eyebrow">Ambient workspace</span>
            <h2>Name your ambient</h2>
            {account.kind === 'signed-in' ? (
              <form onSubmit={createAmbient}>
                <label htmlFor="ambient-name">Ambient name</label>
                <input
                  ref={nameInputRef}
                  id="ambient-name"
                  name="ambientName"
                  maxLength={80}
                  value={ambientName}
                  aria-invalid={formError ? true : undefined}
                  onChange={(event) => setAmbientName(event.target.value)}
                  aria-describedby={formError ? 'ambient-name-error' : undefined}
                />
                {formError && <p id="ambient-name-error" className="workspace-form-error" role="alert">{formError}</p>}
                <div className="workspace-setup-actions">
                  <button className="ui-button" type="button" onClick={onCancel}>Cancel</button>
                  <button className="ui-button ui-button-primary" type="submit" disabled={isCreating}>
                    {isCreating ? 'Creating ambient...' : 'Create ambient'}
                  </button>
                </div>
              </form>
            ) : (
              <button className="ui-button ui-button-primary" type="button" onClick={onSignIn}>
                Sign in to create an ambient
              </button>
            )}
          </div>
        </section>
        <div className="workspace-activity-panel">
          <div className="workspace-sidebar">
            <div className="workspace-sidebar-collapsible">
              <div className="workspace-sidebar-tabs" aria-hidden="true">
                <div className="workspace-sidebar-tablist">
                  <button type="button" disabled>Work</button>
                  <button type="button" disabled>Versions</button>
                </div>
              </div>
              <div className="workspace-sidebar-panel">
                <div className="workspace-work-panel">
                  <section className="workspace-card workspace-status-card" aria-label="Draft status">
                    <h2>Your draft will appear here</h2>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
