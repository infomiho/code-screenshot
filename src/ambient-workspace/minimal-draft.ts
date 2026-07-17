import type { AmbientDocument } from '../ambient-schema'

export const createMinimalDraftDocument = (name = 'New ambient'): AmbientDocument => ({
  schemaVersion: 1,
  name,
  editor: {
    exportGutter: 'show',
    tokens: {
      text: 'oklch(0.2 0 0)',
      comment: 'oklch(0.52 0 0)',
      string: 'oklch(0.34 0 0)',
      keyword: 'oklch(0.12 0 0)',
      number: 'oklch(0.28 0 0)',
      function: 'oklch(0.18 0 0)',
      type: 'oklch(0.18 0 0)',
      punctuation: 'oklch(0.42 0 0)',
    },
  },
  annotations: {
    ink: 'oklch(0.12 0 0)',
  },
  customizations: [],
  template: `
    <div class="draft-canvas">
      <ambient-slot name="code"></ambient-slot>
    </div>
  `,
  stylesheet: `
    :host {
      display: block;
      container: ambient / inline-size;
      background: oklch(0.16 0 0);
      padding: 18px;
    }

    *, *::before, *::after { box-sizing: border-box; }

    .draft-canvas {
      min-height: 280px;
      background: oklch(0.985 0 0);
      box-shadow: 0 0 0 1px oklch(0 0 0 / 18%);
      padding: 28px 30px;
    }

    ::slotted([slot='code']) {
      --ambient-editor-caret-color: oklch(0.12 0 0);
      --ambient-editor-font-size: 15px;
      --ambient-editor-gutter-color: oklch(0.52 0 0);
      --ambient-editor-gutter-gap: 14px;
      --ambient-editor-highlight-background: oklch(0.2 0 0 / 8%);
      --ambient-editor-line-height: 1.6;
      --ambient-editor-selection-background: oklch(0.2 0 0 / 14%);
      --ambient-editor-text-color: oklch(0.2 0 0);
    }

    @container ambient (max-width: 560px) {
      :host { padding: 10px; }
      .draft-canvas { min-height: 220px; padding: 20px 18px; }
      ::slotted([slot='code']) {
        --ambient-editor-font-size: 13px;
        --ambient-editor-gutter-gap: 10px;
      }
    }
  `,
  thumbnail: {
    template: `
      <div class="frame">
        <span class="code"></span>
        <i class="signal"></i>
      </div>
    `,
    stylesheet: `
      :host { display: block; height: 100%; background: oklch(0.16 0 0); padding: 10%; }
      * { box-sizing: border-box; }
      .frame { position: relative; height: 100%; background: oklch(0.985 0 0); }
      .code { position: absolute; inset: 24% 18%; border-block: 1px solid oklch(0.3 0 0); }
      .signal { position: absolute; right: 12%; bottom: 14%; width: 22%; height: 8%; background: oklch(0.58 0.2 265); }
    `,
  },
})
