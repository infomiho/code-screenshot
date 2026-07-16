import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { getAmbientKey, type AmbientDefinition } from './ambient-themes'

type AmbientSelectorProps = {
  definitions: AmbientDefinition[]
  selectedKey: string
  onSelect: (key: string) => void
}

const padIndex = (index: number) => String(index).padStart(2, '0')

function AmbientMark({ definition }: { definition: AmbientDefinition }) {
  return (
    <span
      className={`ambient-mark ambient-mark--${definition.id}`}
      aria-hidden="true"
    />
  )
}

export function AmbientSelector({
  definitions,
  selectedKey,
  onSelect,
}: AmbientSelectorProps) {
  const selectedIndex = Math.max(
    0,
    definitions.findIndex((definition) => getAmbientKey(definition) === selectedKey),
  )
  const selected = definitions[selectedIndex]
  const previous = definitions[(selectedIndex - 1 + definitions.length) % definitions.length]
  const next = definitions[(selectedIndex + 1) % definitions.length]
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(selectedIndex)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!isOpen) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
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
    const option = picker?.querySelector<HTMLElement>(`#ambient-option-${activeIndex}`)
    if (!picker || !option) return

    const optionTop = option.offsetTop
    const optionBottom = optionTop + option.offsetHeight
    if (optionTop < picker.scrollTop) picker.scrollTop = optionTop
    if (optionBottom > picker.scrollTop + picker.clientHeight) {
      picker.scrollTop = optionBottom - picker.clientHeight
    }
  }, [activeIndex, isOpen])

  const selectAt = (index: number, closePicker = false) => {
    const wrappedIndex = (index + definitions.length) % definitions.length
    const definition = definitions[wrappedIndex]

    onSelect(getAmbientKey(definition))
    setStatus(
      `Ambient changed to ${definition.manifest.name}. ${wrappedIndex + 1} of ${definitions.length}.`,
    )

    if (closePicker) {
      setIsOpen(false)
      window.requestAnimationFrame(() => triggerRef.current?.focus())
    }
  }

  const openPicker = () => {
    setActiveIndex(selectedIndex)
    setIsOpen(true)
  }

  const handlePickerKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    let nextIndex = activeIndex

    switch (event.key) {
      case 'ArrowLeft':
        nextIndex = (activeIndex - 1 + definitions.length) % definitions.length
        break
      case 'ArrowUp':
        nextIndex = window.matchMedia('(max-width: 420px)').matches
          ? (activeIndex - 1 + definitions.length) % definitions.length
          : (activeIndex - 2 + definitions.length) % definitions.length
        break
      case 'ArrowRight':
        nextIndex = (activeIndex + 1) % definitions.length
        break
      case 'ArrowDown':
        nextIndex = window.matchMedia('(max-width: 420px)').matches
          ? (activeIndex + 1) % definitions.length
          : (activeIndex + 2) % definitions.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = definitions.length - 1
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        selectAt(activeIndex, true)
        return
      case 'Escape':
        event.preventDefault()
        setIsOpen(false)
        triggerRef.current?.focus()
        return
      case 'Tab':
        setIsOpen(false)
        return
      default: {
        if (event.key.length !== 1) return
        const query = event.key.toLocaleLowerCase()
        const matchIndex = definitions.findIndex((definition) =>
          definition.manifest.name.toLocaleLowerCase().startsWith(query),
        )
        if (matchIndex === -1) return
        nextIndex = matchIndex
      }
    }

    event.preventDefault()
    setActiveIndex(nextIndex)
  }

  return (
    <div className="ambient-selector" ref={rootRef} role="group" aria-label="Ambient">
      <button
        className="ambient-step ambient-step-previous"
        type="button"
        aria-label={`Previous ambient: ${previous.manifest.name}`}
        onClick={() => selectAt(selectedIndex - 1)}
      >
        <span className="ambient-arrow" aria-hidden="true">&#8249;</span>
      </button>

      <button
        ref={triggerRef}
        className="ambient-current"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="ambient-picker"
        onClick={() => (isOpen ? setIsOpen(false) : openPicker())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            openPicker()
          }
        }}
      >
        <AmbientMark definition={selected} />
        <span className="ambient-current-copy">
          <span className="ambient-current-name">{selected.manifest.name}</span>
          <span className="ambient-current-position">
            {padIndex(selectedIndex + 1)} / {padIndex(definitions.length)}
          </span>
        </span>
        <span className="ambient-disclosure" aria-hidden="true">&#8964;</span>
      </button>

      <button
        className="ambient-step ambient-step-next"
        type="button"
        aria-label={`Next ambient: ${next.manifest.name}`}
        onClick={() => selectAt(selectedIndex + 1)}
      >
        <span className="ambient-arrow" aria-hidden="true">&#8250;</span>
      </button>

      {isOpen && (
        <div className="ambient-picker-shell">
          <div className="ambient-picker-heading">
            <span>Choose ambient</span>
            <span>{padIndex(selectedIndex + 1)} / {padIndex(definitions.length)}</span>
            <button
              className="ambient-picker-close"
              type="button"
              aria-label="Close ambient picker"
              onClick={() => {
                setIsOpen(false)
                triggerRef.current?.focus()
              }}
            >
              &#215;
            </button>
          </div>
          <div
            id="ambient-picker"
            ref={pickerRef}
            className="ambient-picker"
            role="listbox"
            aria-label="Choose ambient"
            aria-activedescendant={`ambient-option-${activeIndex}`}
            tabIndex={0}
            onKeyDown={handlePickerKeyDown}
          >
            {definitions.map((definition, index) => (
              <div
                id={`ambient-option-${index}`}
                key={getAmbientKey(definition)}
                className="ambient-picker-option"
                role="option"
                aria-selected={index === selectedIndex}
                data-active={index === activeIndex}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => selectAt(index, true)}
              >
                <AmbientMark definition={definition} />
                <span>{definition.manifest.name}</span>
                {index === selectedIndex && <small>Selected</small>}
              </div>
            ))}
          </div>
        </div>
      )}

      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {status}
      </span>
    </div>
  )
}
