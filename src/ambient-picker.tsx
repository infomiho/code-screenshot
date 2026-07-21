import type { KeyboardEventHandler, RefObject } from 'react'
import { AmbientMark } from './ambient-mark'
import { getAmbientKey, type AmbientDefinition } from './ambient-themes'

export type OwnedAmbientPickerItem = {
  id: string
  name: string
  version: number | null
  draftStatus: 'waiting' | 'review-ready' | 'matches-version' | null
  draftDefinition: AmbientDefinition | null
}

export type YourAmbientsState =
  | { kind: 'signed-out'; onCreateAmbient: () => void; onSignIn: () => void }
  | {
      kind: 'signed-in'
      username: string
      ambients: readonly OwnedAmbientPickerItem[]
      onCreateAmbient: () => void
      onOpenAmbient: (ambientId: string) => void
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

const draftStatusLabel = {
  waiting: 'Working draft',
  'review-ready': 'Ready to review',
  'matches-version': 'Draft synced',
} as const

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

function IncludedAmbientGrid({
  activeIndex,
  entries,
  pickerId,
  selectedIndex,
  onActiveIndexChange,
  onSelect,
}: {
  activeIndex: number
  entries: AmbientPickerEntry[]
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
    <section className="ambient-picker-section" role="rowgroup" aria-label="Included ambients">
      <h3 id={`${pickerId}-included`} aria-hidden="true">Included</h3>
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

function OwnedAmbientList({
  activeIndex,
  entries,
  pickerId,
  selectedIndex,
  state,
  onActiveIndexChange,
  onOpen,
  onSelect,
}: {
  activeIndex: number
  entries: AmbientPickerEntry[]
  pickerId: string
  selectedIndex: number
  state: Extract<YourAmbientsState, { kind: 'signed-in' }>
  onActiveIndexChange: (index: number) => void
  onOpen: (ambientId: string) => void
  onSelect: (index: number) => void
}) {
  const entriesById = new Map(entries.map((entry) => [entry.definition.id, entry]))

  return (
    <section className="ambient-picker-section ambient-owned-section" role="rowgroup" aria-label="Your ambients">
      <h3 id={`${pickerId}-owned`} aria-hidden="true">Your ambients</h3>
      {state.ambients.length === 0 ? (
        <div className="ambient-library-empty">
          <strong>Create your first ambient</strong>
          <span>Build a reusable visual frame with help from your coding agent.</span>
        </div>
      ) : (
        <div className="ambient-picker-group ambient-owned-list" role="presentation">
          {state.ambients.map((ambient) => {
            const entry = entriesById.get(ambient.id)
            return (
              <div
                className="ambient-picker-row ambient-picker-row-list ambient-owned-row"
                role="row"
                key={ambient.id}
                data-active={entry?.index === activeIndex || undefined}
                data-selected={entry?.index === selectedIndex || undefined}
              >
                {entry ? (
                  <AmbientPickerOption
                    {...entry}
                    activeIndex={activeIndex}
                    pickerId={pickerId}
                    selectedIndex={selectedIndex}
                    onActiveIndexChange={onActiveIndexChange}
                    onSelect={onSelect}
                  />
                ) : (
                  <div className="ambient-picker-option ambient-owned-placeholder" role="gridcell">
                    {ambient.draftDefinition
                      ? <AmbientMark definition={ambient.draftDefinition} />
                      : <span className="ambient-owned-placeholder-mark" aria-hidden="true" />}
                    <span>{ambient.name}</span>
                  </div>
                )}
                <div className="ambient-owned-meta" role="gridcell">
                  <span>{ambient.version === null ? 'Not saved' : `Version ${ambient.version}`}</span>
                  <span>Private</span>
                  {ambient.draftStatus && (
                    <strong data-status={ambient.draftStatus}>{draftStatusLabel[ambient.draftStatus]}</strong>
                  )}
                </div>
                <div className="ambient-picker-action-cell" role="gridcell">
                  <button className="ambient-picker-edit" type="button" onClick={() => onOpen(ambient.id)}>
                    {ambient.draftStatus ? 'Open' : 'Edit'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
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
        <span>Choose an ambient</span>
        <button className="ui-button ui-button-ghost ui-button-icon ambient-picker-close" type="button" aria-label="Close ambient picker" onClick={onEscape}>
          &#215;
        </button>
      </div>
      <div
        id={pickerId}
        ref={pickerRef}
        className="ambient-picker"
        role="grid"
        aria-label="Choose ambient"
        aria-activedescendant={`${pickerId}-option-${activeIndex}`}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.target === event.currentTarget) onKeyDown(event)
        }}
      >
        <IncludedAmbientGrid
          activeIndex={activeIndex}
          entries={builtIns}
          pickerId={pickerId}
          selectedIndex={selectedIndex}
          onActiveIndexChange={onActiveIndexChange}
          onSelect={onSelect}
        />
        {yourAmbients.kind === 'signed-in' && (
          <OwnedAmbientList
            activeIndex={activeIndex}
            entries={personal}
            pickerId={pickerId}
            selectedIndex={selectedIndex}
            state={yourAmbients}
            onActiveIndexChange={onActiveIndexChange}
            onOpen={(ambientId) => runAction(() => yourAmbients.onOpenAmbient(ambientId))}
            onSelect={onSelect}
          />
        )}
      </div>
      <section className="ambient-account" data-account={yourAmbients.kind} aria-label="Your ambients account">
        {yourAmbients.kind === 'signed-out' ? (
          <>
            <h3>Your ambients</h3>
            <p>Sign in to create a reusable visual frame.</p>
            <button className="ui-button ui-button-primary ambient-account-action" type="button" onClick={() => runAction(yourAmbients.onCreateAmbient)}>
              Create ambient
            </button>
            <button className="ui-button ambient-account-action" type="button" onClick={() => runAction(yourAmbients.onSignIn)}>
              Sign in with GitHub
            </button>
          </>
        ) : (
          <>
            <div className="ambient-account-meta">@{yourAmbients.username}</div>
            <button className="ui-button ambient-account-action" type="button" onClick={() => runAction(yourAmbients.onCreateAmbient)}>
              Create ambient
            </button>
          </>
        )}
      </section>
    </div>
  )
}
