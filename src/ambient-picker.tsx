import type {
  KeyboardEventHandler,
  RefObject,
} from 'react'
import { AmbientMark } from './ambient-mark'
import { getAmbientKey, type AmbientDefinition } from './ambient-themes'

export type YourAmbientsState =
  | {
      kind: 'signed-out'
      onSignIn: () => void
    }
  | {
      kind: 'signed-in'
      username: string
      draft: { actionLabel: string; name: string; status: string } | null
      canCreate: boolean
      onCreateAmbient: () => void
      onOpenDraft: () => void
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

const getOptionStateLabel = (
  definition: AmbientDefinition,
  index: number,
  selectedIndex: number,
) => {
  if (index === selectedIndex) return 'Selected'
  if (definition.source === 'draft') return 'Draft'
  return null
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
  const stateLabel = getOptionStateLabel(definition, index, selectedIndex)

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
      {stateLabel && <small>{stateLabel}</small>}
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

function AmbientAccountActions({
  hasPersonalAmbients,
  state,
  onAction,
}: {
  hasPersonalAmbients: boolean
  state: YourAmbientsState
  onAction: (action: () => void) => void
}) {
  if (state.kind === 'signed-out') {
    return (
      <section className="ambient-account" aria-label="Your ambients account">
        {!hasPersonalAmbients && <h3>Your ambients</h3>}
        <p>Sign in to create and save ambients.</p>
        <button
          className="ui-button ambient-account-action"
          type="button"
          onClick={() => onAction(state.onSignIn)}
        >
          Sign in with GitHub
        </button>
      </section>
    )
  }

  return (
    <section className="ambient-account" aria-label="Your ambients account">
      {!hasPersonalAmbients && <h3>Your ambients</h3>}
      <div className="ambient-account-meta">@{state.username}</div>
      {state.draft && (
        <div className="ambient-draft-row">
          <div>
            <strong>{state.draft.name}</strong>
            <span>{state.draft.status}</span>
          </div>
          <button className="ui-button" type="button" onClick={() => onAction(state.onOpenDraft)}>
            {state.draft.actionLabel}
          </button>
        </div>
      )}
      {!hasPersonalAmbients && !state.draft && <p>No saved ambients yet.</p>}
      {state.canCreate && (
        <button
          className="ui-button ambient-account-action"
          type="button"
          onClick={() => onAction(state.onCreateAmbient)}
        >
          Create ambient
        </button>
      )}
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
  onEscape,
  onKeyDown,
  onSelect,
}: AmbientPickerProps) {
  const runAction = (action: () => void) => {
    onClose()
    action()
  }

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
        <span>{String(selectedIndex + 1).padStart(2, '0')} / {String(builtIns.length + personal.length).padStart(2, '0')}</span>
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
          entries={builtIns}
          label="Built-in ambients"
          pickerId={pickerId}
          selectedIndex={selectedIndex}
          onActiveIndexChange={onActiveIndexChange}
          onSelect={onSelect}
        />
        {personal.length > 0 && (
          <AmbientPickerGroup
            activeIndex={activeIndex}
            entries={personal}
            label="Your ambients"
            pickerId={pickerId}
            selectedIndex={selectedIndex}
            onActiveIndexChange={onActiveIndexChange}
            onSelect={onSelect}
          />
        )}
      </div>
      <AmbientAccountActions
        hasPersonalAmbients={personal.length > 0}
        state={yourAmbients}
        onAction={runAction}
      />
    </div>
  )
}
