import { useState } from 'react'
import { AmbientCustomizationFields } from '../../customization/ambient-customization-fields'
import type { AmbientCustomizationSlot } from '../../rendering/ambient-themes'

export type PreviewCustomizations = {
  values: Record<string, string>
  onChange: (slotId: string, value: string) => void
  onReset: () => void
}

export const usePreviewCustomizations = (): PreviewCustomizations => {
  const [values, setValues] = useState<Record<string, string>>({})
  return {
    values,
    onChange: (slotId, value) => setValues((current) => ({ ...current, [slotId]: value })),
    onReset: () => setValues({}),
  }
}

type PreviewCustomizationStripProps = {
  customizations: PreviewCustomizations
  label?: string
  slots: readonly AmbientCustomizationSlot[]
}

export function PreviewCustomizationStrip({
  customizations,
  label = 'Preview customizations',
  slots,
}: PreviewCustomizationStripProps) {
  if (slots.length === 0) {
    return null
  }

  const hasChanges = Object.keys(customizations.values).length > 0

  return (
    <div className="workspace-customization-strip" role="group" aria-label={label}>
      <div className="workspace-customization-strip-header">
        <span className="workspace-eyebrow">{label}</span>
        <button
          className="workspace-link-button"
          type="button"
          disabled={!hasChanges}
          onClick={customizations.onReset}
        >
          Reset
        </button>
      </div>
      <div className="workspace-customization-strip-fields">
        <AmbientCustomizationFields
          slots={slots}
          values={customizations.values}
          onChange={customizations.onChange}
        />
      </div>
    </div>
  )
}
