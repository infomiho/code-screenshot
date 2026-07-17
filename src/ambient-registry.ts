import { compileAmbientDocument } from './ambient-compiler'
import type { AmbientDiagnostic, AmbientManifest } from './ambient-schema'
import {
  createAmbientEditorExtension,
  type AmbientDefinition,
} from './ambient-themes'
import type { SavedAmbientRecord } from './ambient-workspace/ambient-workspace-service'

export type AmbientRecordSource = 'draft' | 'saved'

export type AmbientLoadResult =
  | { definition: AmbientDefinition; diagnostics: readonly [] }
  | { definition: null; diagnostics: readonly AmbientDiagnostic[] }

export function loadAmbientDefinition(
  record: SavedAmbientRecord,
  source: AmbientRecordSource,
): AmbientLoadResult {
  const result = compileAmbientDocument(record.document)
  if (!result.compiled) return { definition: null, diagnostics: result.diagnostics }

  const document = result.compiled.document
  const manifest: AmbientManifest = {
    name: document.name,
    editor: document.editor,
    annotations: document.annotations,
    customizations: document.customizations,
  }

  return {
    diagnostics: [],
    definition: {
      id: record.id,
      version: record.version,
      source,
      kind: 'declarative',
      manifest,
      compiledDocument: result.compiled,
      editorExtension: createAmbientEditorExtension(document.editor.tokens),
    },
  }
}
