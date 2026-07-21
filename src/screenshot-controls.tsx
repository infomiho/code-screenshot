import { AmbientCustomizationFields } from './ambient-customization-fields'
import type { AmbientCustomizationSlot } from './ambient-themes'
import type { LanguageOption } from './use-code-editor'

type ScreenshotControlsProps = {
  ambientName: string
  customizationSlots: readonly AmbientCustomizationSlot[]
  customizationValues: Record<string, string> | undefined
  onCustomizationChange: (slotId: string, value: string) => void
  languageId: string
  languageOptions: readonly LanguageOption[]
  onLanguageChange: (languageId: string) => void
  title: string
  onTitleChange: (title: string) => void
  highlightStatusId: string
  highlightedLineCount: number
  highlightedLineStatus: string
  onHighlightCurrentLine: () => void
  onClearHighlights: () => void
}

export function ScreenshotControls({
  ambientName,
  customizationSlots,
  customizationValues,
  onCustomizationChange,
  languageId,
  languageOptions,
  onLanguageChange,
  title,
  onTitleChange,
  highlightStatusId,
  highlightedLineCount,
  highlightedLineStatus,
  onHighlightCurrentLine,
  onClearHighlights,
}: ScreenshotControlsProps) {
  return (
    <div className="control-panel" aria-label="Screenshot controls">
      <div className="control-groups">
        <details className="control-group" open>
          <summary className="control-summary">
            <span className="control-title">Look</span>
            <span className="look-context">{ambientName}</span>
          </summary>
          <div className="control-content look-content">
            <label className="toolbar-field" htmlFor="syntax">
              <span>File type</span>
              <select
                id="syntax"
                name="syntax"
                value={languageId}
                onInput={(event) =>
                  onLanguageChange((event.currentTarget as HTMLSelectElement).value)
                }
              >
                {languageOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="toolbar-field" htmlFor="ambient-title">
              <span>Title</span>
              <input
                id="ambient-title"
                name="ambient-title"
                type="text"
                value={title}
                placeholder="untitled"
                onInput={(event) =>
                  onTitleChange((event.currentTarget as HTMLInputElement).value)
                }
              />
            </label>

            <AmbientCustomizationFields
              slots={customizationSlots}
              values={customizationValues}
              onChange={onCustomizationChange}
            />
          </div>
        </details>

        <details className="control-group">
          <summary className="control-summary">
            <span className="control-title">Highlights</span>
            <span
              id={highlightStatusId}
              className="highlight-status"
              aria-live="polite"
            >
              {highlightedLineStatus}
            </span>
          </summary>
          <div className="control-content">
            <button className="ui-button" type="button" onClick={onHighlightCurrentLine}>
              Highlight current line
            </button>
            <button
              className="ui-button"
              type="button"
              onClick={onClearHighlights}
              disabled={highlightedLineCount === 0}
            >
              Clear highlights
            </button>
          </div>
        </details>
      </div>
    </div>
  )
}
