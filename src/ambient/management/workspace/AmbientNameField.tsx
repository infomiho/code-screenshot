import { IconPencil } from '@tabler/icons-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

const maximumNameLength = 80

type AmbientNameFieldProps = {
  name: string
  onRename: (name: string) => Promise<boolean>
}

// Commits on Enter or blur rather than per keystroke, because every rename advances the revision.
export function AmbientNameField({ name, onRename }: AmbientNameFieldProps) {
  const [value, setValue] = useState(name)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isEditing) setValue(name)
  }, [isEditing, name])

  useEffect(() => {
    if (!isEditing) return
    const input = inputRef.current
    if (!input) return
    input.focus()
    input.select()
  }, [isEditing])

  const restoreTriggerFocus = () => requestAnimationFrame(() => triggerRef.current?.focus())

  const finishEditing = (restoreFocus: boolean) => {
    setIsEditing(false)
    if (restoreFocus) restoreTriggerFocus()
  }

  const commit = async (restoreFocus: boolean) => {
    if (isSaving) return
    const next = value.trim()
    if (!next || next === name) {
      setValue(name)
      finishEditing(restoreFocus)
      return
    }

    setIsSaving(true)
    const renamed = await onRename(next)
    setIsSaving(false)
    if (renamed) {
      setValue(next)
      finishEditing(restoreFocus)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void commit(true)
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setValue(name)
      finishEditing(true)
    }
  }

  if (!isEditing) {
    return (
      <button
        ref={triggerRef}
        className="ambient-name-trigger"
        type="button"
        aria-label={`Rename theme: ${name}`}
        title={name}
        onClick={() => setIsEditing(true)}
      >
        <span>{name}</span>
        <IconPencil aria-hidden="true" />
      </button>
    )
  }

  return (
    <input
      ref={inputRef}
      className="ambient-name-field"
      type="text"
      aria-label="Theme name"
      aria-busy={isSaving}
      maxLength={maximumNameLength}
      readOnly={isSaving}
      spellCheck={false}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => void commit(false)}
    />
  )
}
