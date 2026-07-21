import type { AmbientDocument } from '../ambient-schema'

export const createMinimalDraftDocument = (name = 'New ambient'): AmbientDocument => ({
  schemaVersion: 1,
  name,
  editor: {
    exportGutter: 'show',
    // Nordic near-grayscale ramp with a single frost-blue accent, so the
    // syntax hierarchy is visible and shows agents how token colors are used.
    tokens: {
      text: 'oklch(0.28 0.012 260)',
      comment: 'oklch(0.68 0.01 260)',
      string: 'oklch(0.52 0.02 260)',
      keyword: 'oklch(0.52 0.09 255)',
      number: 'oklch(0.46 0.025 260)',
      function: 'oklch(0.3 0.015 260)',
      type: 'oklch(0.4 0.02 260)',
      punctuation: 'oklch(0.6 0.015 260)',
    },
  },
  annotations: {
    ink: 'oklch(0.52 0.09 255)',
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
      background: oklch(0.28 0.02 260);
      padding: 18px;
    }

    *, *::before, *::after { box-sizing: border-box; }

    .draft-canvas {
      min-height: 280px;
      background: oklch(0.96 0.006 250);
      box-shadow: 0 0 0 1px oklch(0.96 0.006 250 / 25%);
      padding: 28px 30px;
    }

    ::slotted([slot='code']) {
      --ambient-editor-caret-color: oklch(0.52 0.09 255);
      --ambient-editor-font-size: 15px;
      --ambient-editor-gutter-color: oklch(0.64 0.015 260);
      --ambient-editor-gutter-gap: 14px;
      --ambient-editor-highlight-accent: oklch(0.52 0.09 255);
      --ambient-editor-highlight-background: oklch(0.52 0.09 255 / 10%);
      --ambient-editor-line-height: 1.6;
      --ambient-editor-selection-background: oklch(0.52 0.09 255 / 18%);
      --ambient-editor-text-color: oklch(0.28 0.012 260);
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
        <span class="line line-keyword"></span>
        <span class="line line-body"></span>
        <span class="line line-comment"></span>
      </div>
    `,
    stylesheet: `
      :host { display: block; height: 100%; background: oklch(0.28 0.02 260); padding: 10%; }
      * { box-sizing: border-box; }
      .frame { position: relative; height: 100%; background: oklch(0.96 0.006 250); }
      .line { position: absolute; left: 16%; height: 7%; }
      .line-keyword { top: 26%; width: 46%; background: oklch(0.52 0.09 255); }
      .line-body { top: 46%; width: 58%; background: oklch(0.4 0.02 260); }
      .line-comment { top: 66%; width: 32%; background: oklch(0.68 0.01 260); }
    `,
  },
})
