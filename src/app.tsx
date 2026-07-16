import {
  useId,
  useState,
} from 'react'
import './index.css'
import {
  defaultAmbientKey,
  getAmbientDefinition,
  resolveAmbientVariables,
  type AmbientCustomizationState,
  type ScreenshotContent,
} from './ambient-themes'
import { ScreenshotControls } from './screenshot-controls'
import { ScreenshotPreview } from './screenshot-preview'
import { useCodeEditor } from './use-code-editor'

export function App() {
  const editorHelpId = `${useId()}-editor-help`
  const highlightStatusId = `${useId()}-highlight-status`
  const [languageId, setLanguageId] = useState('typescript')
  const [ambientKey, setAmbientKey] = useState(defaultAmbientKey)
  const [title, setTitle] = useState('top secret code')
  const [ambientCustomizations, setAmbientCustomizations] =
    useState<AmbientCustomizationState>({})
  const selectedAmbient = getAmbientDefinition(ambientKey)
  const selectedCustomizationSlots = selectedAmbient.manifest.customizations
  const selectedCustomizationValues = ambientCustomizations[ambientKey]
  const ariaDescribedBy = `${editorHelpId} ${highlightStatusId}`
  const {
    languageOptions,
    selectedLanguage,
    code,
    editorHostRef,
    highlightedLineCount,
    highlightedLineStatus,
    highlightCurrentLine,
    clearHighlights,
  } = useCodeEditor({
    languageId,
    ambientEditorExtension: selectedAmbient.editorExtension,
    ariaDescribedBy,
  })
  const selectedFileType: ScreenshotContent['fileType'] = {
    id: selectedLanguage.id,
    label: selectedLanguage.label,
    syntax: selectedLanguage.lang,
  }
  const screenshotContent: ScreenshotContent = {
    title,
    fileType: selectedFileType,
    lineCount: code.split('\n').length,
  }
  const ambientVariables = resolveAmbientVariables(
    selectedAmbient,
    ambientCustomizations,
  )

  const updateAmbientCustomization = (slotId: string, value: string) => {
    setAmbientCustomizations((current) => ({
      ...current,
      [ambientKey]: {
        ...current[ambientKey],
        [slotId]: value,
      },
    }))
  }

  const selectAmbient = (nextAmbientKey: string) => setAmbientKey(nextAmbientKey)
  const selectLanguage = (nextLanguageId: string) => setLanguageId(nextLanguageId)
  const updateTitle = (nextTitle: string) => setTitle(nextTitle)

  return (
    <main className="app-shell">
      <h1 className="sr-only">codeshot.dev code screenshot tool</h1>
      <section className="workspace" aria-label="Editable screenshot">
        <ScreenshotPreview
          ambientKey={ambientKey}
          onAmbientChange={selectAmbient}
          selectedAmbient={selectedAmbient}
          screenshotContent={screenshotContent}
          ambientVariables={ambientVariables}
          editorHostRef={editorHostRef}
          editorHelpId={editorHelpId}
        />
        <ScreenshotControls
          ambientName={selectedAmbient.manifest.name}
          customizationSlots={selectedCustomizationSlots}
          customizationValues={selectedCustomizationValues}
          onCustomizationChange={updateAmbientCustomization}
          languageId={languageId}
          languageOptions={languageOptions}
          onLanguageChange={selectLanguage}
          title={title}
          onTitleChange={updateTitle}
          highlightStatusId={highlightStatusId}
          highlightedLineCount={highlightedLineCount}
          highlightedLineStatus={highlightedLineStatus}
          onHighlightCurrentLine={highlightCurrentLine}
          onClearHighlights={clearHighlights}
        />
      </section>
    </main>
  )
}
