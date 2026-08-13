import type { KeyboardEventHandler, RefObject } from 'react'
import { IconX } from '@tabler/icons-react'
import { AmbientMark } from '../rendering/ambient-mark'
import { getAmbientKey, type AmbientDefinition } from '../rendering/ambient-themes'
import './ambient-picker.css'

export type YourAmbientsState =
  | { kind: 'signed-out' }
  | { kind: 'signed-in' }

export type AmbientPickerEntry = {
  definition: AmbientDefinition
  index: number
}

type AmbientPickerProps = {
  activeIndex: number
  builtIns: AmbientPickerEntry[]
  personal: AmbientPickerEntry[]
  pickerId: string
  pickerRef: RefObject<HTMLDivElement | null>
  selectedIndex: number
  yourAmbients: YourAmbientsState
  isCreatingTheme: boolean
  onActiveIndexChange: (index: number) => void
  onClose: () => void
  onCreateTheme: () => void
  onKeyDown: KeyboardEventHandler<HTMLDivElement>
  onSelect: (index: number) => void
}

function AmbientPickerOption({
  activeIndex,
  definition,
  index,
  pickerId,
  selectedIndex,
  onActiveIndexChange,
  onSelect,
}: AmbientPickerEntry & {
  activeIndex: number
  pickerId: string
  selectedIndex: number
  onActiveIndexChange: (index: number) => void
  onSelect: (index: number) => void
}) {
  return (
    <div
      id={`${pickerId}-option-${index}`}
      className="ambient-picker-option"
      role="gridcell"
      aria-selected={index === selectedIndex}
      data-active={index === activeIndex}
      onPointerMove={() => onActiveIndexChange(index)}
    >
      <button
        className="ambient-picker-option-button"
        type="button"
        tabIndex={-1}
        onClick={() => onSelect(index)}
      >
        <AmbientMark definition={definition} />
        <span>{definition.manifest.name}</span>
        {index === selectedIndex && <small>Selected</small>}
      </button>
    </div>
  )
}

function AmbientOptionGrid({
  activeIndex,
  entries,
  heading,
  headingId,
  label,
  pickerId,
  selectedIndex,
  onActiveIndexChange,
  onSelect,
}: {
  activeIndex: number
  entries: AmbientPickerEntry[]
  heading: string
  headingId: string
  label: string
  pickerId: string
  selectedIndex: number
  onActiveIndexChange: (index: number) => void
  onSelect: (index: number) => void
}) {
  const rows = Array.from(
    { length: Math.ceil(entries.length / 2) },
    (_, index) => entries.slice(index * 2, index * 2 + 2),
  )

  return (
    <section className="ambient-picker-section" role="rowgroup" aria-label={label}>
      <h3 id={headingId} aria-hidden="true">{heading}</h3>
      <div className="ambient-picker-group" role="presentation">
        {rows.map((row) => (
          <div className="ambient-picker-row ambient-picker-row-grid" role="row" key={row.map(({ definition }) => getAmbientKey(definition)).join(':')}>
            {row.map((entry) => (
              <AmbientPickerOption
                {...entry}
                activeIndex={activeIndex}
                key={getAmbientKey(entry.definition)}
                pickerId={pickerId}
                selectedIndex={selectedIndex}
                onActiveIndexChange={onActiveIndexChange}
                onSelect={onSelect}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

export function AmbientPicker({
  activeIndex,
  builtIns,
  personal,
  pickerId,
  pickerRef,
  selectedIndex,
  yourAmbients,
  isCreatingTheme,
  onActiveIndexChange,
  onClose,
  onCreateTheme,
  onKeyDown,
  onSelect,
}: AmbientPickerProps) {
  return (
    <>
      <div className="ambient-picker-heading">
        <span>Choose a theme</span>
        <button className="ui-button ui-button-ghost ui-button-icon ambient-picker-close" type="button" aria-label="Close theme picker" onClick={onClose}>
          <IconX aria-hidden="true" />
        </button>
      </div>
      <div
        id={pickerId}
        ref={pickerRef}
        className="ambient-picker"
        role="grid"
        aria-label="Choose theme"
        aria-activedescendant={`${pickerId}-option-${activeIndex}`}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.target === event.currentTarget) onKeyDown(event)
        }}
      >
        <AmbientOptionGrid
          activeIndex={activeIndex}
          entries={builtIns}
          heading="Included"
          headingId={`${pickerId}-included`}
          label="Included themes"
          pickerId={pickerId}
          selectedIndex={selectedIndex}
          onActiveIndexChange={onActiveIndexChange}
          onSelect={onSelect}
        />
        {yourAmbients.kind === 'signed-in' && personal.length > 0 && (
          <AmbientOptionGrid
            activeIndex={activeIndex}
            entries={personal}
            heading="Your themes"
            headingId={`${pickerId}-owned`}
            label="Your themes"
            pickerId={pickerId}
            selectedIndex={selectedIndex}
            onActiveIndexChange={onActiveIndexChange}
            onSelect={onSelect}
          />
        )}
      </div>
      {personal.length === 0 && (
        <section className="ambient-picker-empty" aria-labelledby={`${pickerId}-empty-heading`}>
          <h3 id={`${pickerId}-empty-heading`}>Your themes</h3>
          <p>Create a custom theme with your agent in 1-2 minutes.</p>
          <button
            className="ui-button ui-button-primary"
            type="button"
            aria-busy={isCreatingTheme}
            disabled={isCreatingTheme}
            onClick={onCreateTheme}
          >
            Create theme
          </button>
        </section>
      )}
    </>
  )
}
