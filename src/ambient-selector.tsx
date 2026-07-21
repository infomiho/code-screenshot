import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { AmbientIdentity } from './ambient-identity'
import {
  AmbientPicker,
  type YourAmbientsState,
} from './ambient-picker'
import { getAmbientKey, type AmbientDefinition } from './ambient-themes'

export type { YourAmbientsState } from './ambient-picker'

type AmbientSelectorProps = {
  definitions: readonly AmbientDefinition[]
  selectedKey: string
  yourAmbients: YourAmbientsState
  onOpenChange?: (isOpen: boolean) => void
  onSelect: (key: string) => void
}

const padIndex = (index: number) => String(index).padStart(2, '0')

// Both picker sections are two-column grids; vertical moves stay in the same
// column, cross section boundaries, and wrap around the ends.
export const getVerticalAmbientIndex = (
  activeIndex: number,
  direction: -1 | 1,
  builtInCount: number,
  totalCount: number,
) => {
  const personalCount = totalCount - builtInCount
  const sections = personalCount > 0
    ? [{ start: 0, count: builtInCount }, { start: builtInCount, count: personalCount }]
    : [{ start: 0, count: builtInCount }]
  const sectionIndex = activeIndex >= builtInCount ? 1 : 0
  const section = sections[sectionIndex]
  const local = activeIndex - section.start
  const column = local % 2
  const row = Math.floor(local / 2)
  const lastRow = Math.ceil(section.count / 2) - 1
  const enterRow = (target: { start: number; count: number }, targetRow: number) =>
    target.start + Math.min(targetRow * 2 + column, target.count - 1)

  if (direction === -1) {
    if (row > 0) return enterRow(section, row - 1)
    const target = sections[(sectionIndex - 1 + sections.length) % sections.length]
    return enterRow(target, Math.ceil(target.count / 2) - 1)
  }

  if (row < lastRow) return enterRow(section, row + 1)
  return enterRow(sections[(sectionIndex + 1) % sections.length], 0)
}

export function AmbientSelector({
  definitions,
  selectedKey,
  yourAmbients,
  onOpenChange,
  onSelect,
}: AmbientSelectorProps) {
  const pickerId = `${useId()}-ambient-picker`
  const selectedIndex = Math.max(
    0,
    definitions.findIndex((definition) => getAmbientKey(definition) === selectedKey),
  )
  const selected = definitions[selectedIndex]
  const previous = definitions[(selectedIndex - 1 + definitions.length) % definitions.length]
  const next = definitions[(selectedIndex + 1) % definitions.length]
  const entries = definitions.map((definition, index) => ({ definition, index }))
  const builtIns = entries.filter(({ definition }) => definition.source === 'built-in')
  const personal = entries.filter(({ definition }) => definition.source !== 'built-in')
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(selectedIndex)
  const [status, setStatus] = useState('')

  const updateOpen = (nextOpen: boolean) => {
    setIsOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  const closeAndRestoreFocus = () => {
    updateOpen(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  useEffect(() => {
    if (!isOpen) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) updateOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    setActiveIndex(selectedIndex)
    pickerRef.current?.focus({ preventScroll: true })
  }, [isOpen, selectedIndex])

  useEffect(() => {
    if (!isOpen) return
    const picker = pickerRef.current
    const option = document.getElementById(`${pickerId}-option-${activeIndex}`)
    if (!picker || !option) return

    const optionTop = option.offsetTop
    const optionBottom = optionTop + option.offsetHeight
    if (optionTop < picker.scrollTop) picker.scrollTop = optionTop
    if (optionBottom > picker.scrollTop + picker.clientHeight) {
      picker.scrollTop = optionBottom - picker.clientHeight
    }
  }, [activeIndex, isOpen, pickerId])

  const selectAt = (index: number, closeAfterSelection = false) => {
    const wrappedIndex = (index + definitions.length) % definitions.length
    const definition = definitions[wrappedIndex]
    onSelect(getAmbientKey(definition))
    setStatus(
      `Ambient changed to ${definition.manifest.name}. ${wrappedIndex + 1} of ${definitions.length}.`,
    )

    if (closeAfterSelection) {
      closeAndRestoreFocus()
    }
  }

  const handlePickerKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    let nextIndex = activeIndex
    const builtInCount = builtIns.length

    if (event.key === 'ArrowLeft') nextIndex -= 1
    else if (event.key === 'ArrowRight') nextIndex += 1
    else if (event.key === 'ArrowUp') {
      nextIndex = getVerticalAmbientIndex(activeIndex, -1, builtInCount, definitions.length)
    } else if (event.key === 'ArrowDown') {
      nextIndex = getVerticalAmbientIndex(activeIndex, 1, builtInCount, definitions.length)
    }
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = definitions.length - 1
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectAt(activeIndex, true)
      return
    } else if (event.key.length === 1) {
      const query = event.key.toLocaleLowerCase()
      const matchIndex = definitions.findIndex((definition) =>
        definition.manifest.name.toLocaleLowerCase().startsWith(query),
      )
      if (matchIndex === -1) return
      nextIndex = matchIndex
    } else return

    event.preventDefault()
    setActiveIndex((nextIndex + definitions.length) % definitions.length)
  }

  return (
    <div
      className="ambient-selector"
      data-picker-open={isOpen || undefined}
      ref={rootRef}
      role="group"
      aria-label="Ambient"
    >
      <button
        className="ambient-step ambient-step-previous"
        type="button"
        aria-label={`Previous ambient: ${previous.manifest.name}`}
        onClick={() => selectAt(selectedIndex - 1)}
      >
        <span className="ambient-arrow" aria-hidden="true" />
      </button>
      <button
        ref={triggerRef}
        className="ambient-current"
        type="button"
        aria-haspopup="grid"
        aria-expanded={isOpen}
        aria-controls={pickerId}
        onClick={() => updateOpen(!isOpen)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown') return
          event.preventDefault()
          updateOpen(true)
        }}
      >
        <AmbientIdentity
          definition={selected}
          meta={`${padIndex(selectedIndex + 1)} / ${padIndex(definitions.length)}`}
          showDisclosure
        />
      </button>
      <button
        className="ambient-step ambient-step-next"
        type="button"
        aria-label={`Next ambient: ${next.manifest.name}`}
        onClick={() => selectAt(selectedIndex + 1)}
      >
        <span className="ambient-arrow" aria-hidden="true" />
      </button>

      {isOpen && (
        <AmbientPicker
          activeIndex={activeIndex}
          builtIns={builtIns}
          personal={personal}
          pickerId={pickerId}
          pickerRef={pickerRef}
          selectedIndex={selectedIndex}
          yourAmbients={yourAmbients}
          onActiveIndexChange={setActiveIndex}
          onClose={() => updateOpen(false)}
          onEscape={closeAndRestoreFocus}
          onKeyDown={handlePickerKeyDown}
          onSelect={(index) => selectAt(index, true)}
        />
      )}

      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{status}</span>
    </div>
  )
}
