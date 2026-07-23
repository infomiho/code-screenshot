import { useId } from 'react'
import type { AmbientCustomizationSlot } from '../rendering/ambient-themes'

type AmbientCustomizationFieldsProps = {
  slots: readonly AmbientCustomizationSlot[]
  values: Record<string, string> | undefined
  onChange: (slotId: string, value: string) => void
}

export function AmbientCustomizationFields({
  slots,
  values,
  onChange,
}: AmbientCustomizationFieldsProps) {
  const idBase = useId()

  return (
    <>
      {slots.map((slot) => {
        const controlId = `${idBase}-${slot.id}`
        const value = values?.[slot.id]

        return (
          <label className="toolbar-field" htmlFor={controlId} key={slot.id}>
            <span>{slot.label}</span>
            {slot.type === 'palette' ? (
              <select
                className="ambient-option-control"
                id={controlId}
                name={`ambient-option-${slot.id}`}
                value={value ?? slot.defaultOptionId}
                onInput={(event) => onChange(slot.id, event.currentTarget.value)}
              >
                {slot.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="ambient-option-control"
                id={controlId}
                name={`ambient-option-${slot.id}`}
                type="color"
                value={value ?? slot.defaultValue}
                onInput={(event) => onChange(slot.id, event.currentTarget.value)}
              />
            )}
          </label>
        )
      })}
    </>
  )
}
