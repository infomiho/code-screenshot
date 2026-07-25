import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

const maximumNameLength = 80

type AmbientNameFieldProps = {
  name: string
  onRename: (name: string) => Promise<boolean>
}

// Always a real input rather than click-to-edit, so there is no mode to discover and keyboard users
// tab straight into it. Renaming commits on Enter or blur rather than on each keystroke, because
// every rename advances the draft revision.
export function AmbientNameField({ name, onRename }: AmbientNameFieldProps) {
  const [value, setValue] = useState(name)
  const savedName = useRef(name)

  useEffect(() => {
    savedName.current = name
    setValue(name)
  }, [name])

  const commit = async () => {
    const next = value.trim()
    if (!next || next === savedName.current) {
      setValue(savedName.current)
      return
    }
    const renamed = await onRename(next)
    if (renamed) {
      savedName.current = next
      setValue(next)
    } else {
      setValue(savedName.current)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setValue(savedName.current)
      event.currentTarget.blur()
    }
  }

  return (
    <input
      className="ambient-name-field"
      type="text"
      aria-label="Theme name"
      maxLength={maximumNameLength}
      spellCheck={false}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => void commit()}
    />
  )
}
