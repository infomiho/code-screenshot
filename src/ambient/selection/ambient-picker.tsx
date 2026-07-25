import type { KeyboardEventHandler, RefObject } from 'react'
import { AmbientMark } from '../rendering/ambient-mark'
import { getAmbientKey, type AmbientDefinition } from '../rendering/ambient-themes'
import './ambient-picker.css'

export type YourAmbientsState =
  | { kind: 'signed-out'; onCreateAmbient: () => void }
  | {
      kind: 'signed-in'
      hasAmbients: boolean
      onCreateAmbient: () => void
      onManageAmbients: () => void
    }

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
  onActiveIndexChange: (index: number) => void
  onClose: () => void
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
  onActiveIndexChange,
  onClose,
  onKeyDown,
  onSelect,
}: AmbientPickerProps) {
  const runAction = (action: () => void) => {
    onClose()
    action()
  }

  return (
    <>
      <div className="ambient-picker-heading">
        <span>Choose a theme</span>
        <button className="ui-button ui-button-ghost ui-button-icon ambient-picker-close" type="button" aria-label="Close theme picker" onClick={onClose}>
          &#215;
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
      <section className="ambient-account" aria-label="Your themes account">
        {yourAmbients.kind === 'signed-out' ? (
          <>
            <h3>Your themes</h3>
            <p>Build your own reusable visual frame with your coding agent.</p>
            <button className="ui-button ui-button-primary ambient-account-action" type="button" onClick={() => runAction(yourAmbients.onCreateAmbient)}>
              Create your own theme
            </button>
          </>
        ) : yourAmbients.hasAmbients ? (
          <button className="ambient-account-manage" type="button" onClick={() => runAction(yourAmbients.onManageAmbients)}>
            <span>Manage your themes</span>
            <span aria-hidden="true">→</span>
          </button>
        ) : (
          <>
            <h3>Your themes</h3>
            <p>Build a reusable visual frame with help from your coding agent.</p>
            <button className="ui-button ui-button-primary ambient-account-action" type="button" onClick={() => runAction(yourAmbients.onCreateAmbient)}>
              Create your own theme
            </button>
          </>
        )}
      </section>
    </>
  )
}
