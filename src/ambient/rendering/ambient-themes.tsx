import type { ComponentType, ReactNode } from 'react'
import type { Extension } from '@codemirror/state'
import './ambient-themes.css'
import type {
  AmbientManifest,
  CompiledAmbientDocument,
  ScreenshotContent,
} from '../schema'
import { bareTerminalAmbientDefinition } from './themes/bare-terminal'
import { fieldNotebookAmbientDefinition } from './themes/field-notebook'
import { macosAmbientDefinition } from './themes/macos'
import { specimenCardAmbientDefinition } from './themes/specimen-card'
import { swissPosterAmbientDefinition } from './themes/swiss-poster'
import { technicalPlateAmbientDefinition } from './themes/technical-plate'

export type {
  AmbientCustomizationSlot,
  AmbientManifest,
  AmbientTokenPalette,
  ScreenshotContent,
} from '../schema'

export { createAmbientEditorExtension } from './ambient-highlighting'

export type AmbientShellProps = {
  content: ScreenshotContent
  children: ReactNode
}

type AmbientDefinitionBase = {
  id: string
  version: number
  source: 'built-in' | 'draft' | 'saved' | 'shared'
  manifest: AmbientManifest
  editorExtension: Extension
}

type ReactAmbientDefinition = AmbientDefinitionBase & {
  kind: 'react'
  frameClass: string
  Shell: ComponentType<AmbientShellProps>
}

type DeclarativeAmbientDefinition = AmbientDefinitionBase & {
  kind: 'declarative'
  compiledDocument: CompiledAmbientDocument
}

export type AmbientDefinition = ReactAmbientDefinition | DeclarativeAmbientDefinition

export type AmbientCustomizationState = Record<string, Record<string, string>>

export const ambientDefinitions: readonly AmbientDefinition[] = [
  macosAmbientDefinition,
  technicalPlateAmbientDefinition,
  specimenCardAmbientDefinition,
  swissPosterAmbientDefinition,
  fieldNotebookAmbientDefinition,
  bareTerminalAmbientDefinition,
]

export const getAmbientKey = (definition: AmbientDefinition) =>
  `${definition.id}@${definition.version}`

export const defaultAmbientKey = getAmbientKey(ambientDefinitions[0])

export const getAmbientDefinition = (
  id: string,
  definitions: readonly AmbientDefinition[] = ambientDefinitions,
) => {
  const definition = definitions.find((candidate) => getAmbientKey(candidate) === id)

  if (!definition) throw new Error(`Unknown ambient: ${id}`)
  return definition
}

export const resolveAmbientVariables = (
  definition: AmbientDefinition,
  state: AmbientCustomizationState,
) =>
  Object.fromEntries(
    definition.manifest.customizations.map((slot) => {
      const selectedValue = state[getAmbientKey(definition)]?.[slot.id]

      if (slot.type === 'color') {
        return [slot.cssVariable, selectedValue ?? slot.defaultValue]
      }

      const selectedOption = slot.options.find((option) => option.id === selectedValue)
      const defaultOption = slot.options.find((option) => option.id === slot.defaultOptionId)

      if (!defaultOption) throw new Error(`Missing default option for ${slot.id}`)
      return [slot.cssVariable, selectedOption?.value ?? defaultOption.value]
    }),
  )
