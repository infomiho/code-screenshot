import type {
  KeyboardEventHandler,
  RefObject,
} from 'react'
import { AmbientMark } from './ambient-mark'
import { getAmbientKey, type AmbientDefinition } from './ambient-themes'

export type AmbientPickerEntry = {
  definition: AmbientDefinition
  index: number
}

type AmbientPickerProps = {
  activeIndex: number
  entries: AmbientPickerEntry[]
  pickerId: string
  pickerRef: RefObject<HTMLDivElement | null>
  selectedIndex: number
  onActiveIndexChange: (index: number) => void
  onClose: () => void
  onEscape: () => void
  onKeyDown: KeyboardEventHandler<HTMLDivElement>
  onSelect: (index: number) => void
}

type AmbientPickerOptionProps = AmbientPickerEntry & {
  activeIndex: number
  pickerId: string
  selectedIndex: number
  onActiveIndexChange: (index: number) => void
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
}: AmbientPickerOptionProps) {
  return (
    <div
      id={`${pickerId}-option-${index}`}
      className="ambient-picker-option"
      role="option"
      aria-selected={index === selectedIndex}
      data-active={index === activeIndex}
      onPointerMove={() => onActiveIndexChange(index)}
      onClick={() => onSelect(index)}
    >
      <AmbientMark definition={definition} />
      <span>{definition.manifest.name}</span>
      {index === selectedIndex && <small>Selected</small>}
    </div>
  )
}

function AmbientPickerGroup({
  activeIndex,
  entries,
  label,
  pickerId,
  selectedIndex,
  onActiveIndexChange,
  onSelect,
}: {
  activeIndex: number
  entries: AmbientPickerEntry[]
  label: string
  pickerId: string
  selectedIndex: number
  onActiveIndexChange: (index: number) => void
  onSelect: (index: number) => void
}) {
  const headingId = `${pickerId}-${label.toLocaleLowerCase().replaceAll(' ', '-')}`

  return (
    <div className="ambient-picker-group" role="group" aria-labelledby={headingId}>
      <h3 id={headingId}>{label}</h3>
      {entries.map(({ definition, index }) => (
        <AmbientPickerOption
          activeIndex={activeIndex}
          definition={definition}
          index={index}
          key={getAmbientKey(definition)}
          pickerId={pickerId}
          selectedIndex={selectedIndex}
          onActiveIndexChange={onActiveIndexChange}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

export function AmbientPicker({
  activeIndex,
  entries,
  pickerId,
  pickerRef,
  selectedIndex,
  onActiveIndexChange,
  onClose,
  onEscape,
  onKeyDown,
  onSelect,
}: AmbientPickerProps) {
  return (
    <div
      className="ambient-picker-shell"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onClose()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        event.stopPropagation()
        onEscape()
      }}
    >
      <div className="ambient-picker-heading">
        <span>Choose ambient</span>
        <span>{String(selectedIndex + 1).padStart(2, '0')} / {String(entries.length).padStart(2, '0')}</span>
        <button
          className="ui-button ui-button-ghost ui-button-icon ambient-picker-close"
          type="button"
          aria-label="Close ambient picker"
          onClick={onEscape}
        >
          &#215;
        </button>
      </div>
      <div
        id={pickerId}
        ref={pickerRef}
        className="ambient-picker"
        role="listbox"
        aria-label="Choose ambient"
        aria-activedescendant={`${pickerId}-option-${activeIndex}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <AmbientPickerGroup
          activeIndex={activeIndex}
          entries={entries}
          label="Built-in ambients"
          pickerId={pickerId}
          selectedIndex={selectedIndex}
          onActiveIndexChange={onActiveIndexChange}
          onSelect={onSelect}
        />
      </div>
    </div>
  )
}
