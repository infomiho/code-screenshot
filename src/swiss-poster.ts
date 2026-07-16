import type { AmbientDocument, CompiledAmbientDocument } from './ambient-schema'

export const swissPosterDocument = {
  schemaVersion: 1,
  name: 'Swiss poster',
  editor: {
    exportGutter: 'show',
    tokens: {
      text: 'oklch(0.205 0.012 65)',
      comment: 'oklch(0.53 0.018 72)',
      string: 'oklch(0.43 0.095 148)',
      keyword: 'oklch(0.42 0.125 252)',
      number: 'oklch(0.48 0.105 72)',
      function: 'oklch(0.255 0.025 285)',
      type: 'oklch(0.42 0.125 252)',
      punctuation: 'oklch(0.205 0.012 65)',
    },
  },
  annotations: {
    ink: 'oklch(0.205 0.012 65)',
  },
  customizations: [{
    type: 'palette',
    id: 'poster-ground',
    label: 'Poster ground',
    cssVariable: '--ambient-poster-ground',
    valueKind: 'color',
    defaultOptionId: 'signal-red',
    options: [
      { id: 'signal-red', label: 'Signal red', value: 'oklch(0.58 0.22 28)' },
      { id: 'cobalt', label: 'Cobalt', value: 'oklch(0.55 0.145 252)' },
      { id: 'fir', label: 'Fir', value: 'oklch(0.48 0.105 155)' },
      { id: 'ochre', label: 'Ochre', value: 'oklch(0.72 0.13 82)' },
      { id: 'plum', label: 'Plum', value: 'oklch(0.46 0.105 325)' },
    ],
  }],
  template: `
    <article class="shell">
      <header class="swiss-header">
        <div class="swiss-title">
          <span class="swiss-label">Title</span>
          <h2><ambient-slot name="title" fallback="Untitled" tooltip></ambient-slot></h2>
        </div>
      </header>
      <div class="code-body"><ambient-slot name="code"></ambient-slot></div>
      <footer class="swiss-footer">
        <div class="swiss-meta">
          <span class="swiss-label">File type</span>
          <span class="swiss-value"><ambient-slot name="fileTypeLabel"></ambient-slot></span>
        </div>
        <div class="swiss-meta">
          <span class="swiss-label">Lines</span>
          <span class="swiss-value"><ambient-slot name="lineCount" format="pad-3"></ambient-slot></span>
        </div>
      </footer>
    </article>
  `,
  stylesheet: `
    :host {
      --poster-paper: oklch(0.965 0.012 88);
      --poster-ink: oklch(0.205 0.012 65);
      --poster-muted: oklch(0.49 0.018 70);
      --poster-rule: oklch(0.205 0.012 65 / 0.72);
      display: block;
      container: ambient / inline-size;
      background: var(--ambient-poster-ground);
      padding: 24px;
    }

    *, *::before, *::after { box-sizing: border-box; }

    .shell {
      --poster-header-height: 112px;
      --poster-footer-height: 56px;
      --poster-pad-inline: 32px;
      --poster-title-size: 42px;
      --poster-signal-height: 10px;
      position: relative;
      overflow: hidden;
      border: 1px solid var(--poster-ink);
      background: var(--poster-paper);
      color: var(--poster-ink);
    }

    .swiss-header {
      display: grid;
      height: var(--poster-header-height);
      overflow: hidden;
      align-items: end;
      border-top: var(--poster-signal-height) solid var(--ambient-poster-ground);
      border-bottom: 1px solid var(--poster-rule);
      padding: 24px var(--poster-pad-inline) 22px;
    }

    .swiss-title {
      display: grid;
      max-width: 100%;
      gap: 8px;
    }

    .swiss-label {
      color: var(--poster-muted);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      line-height: 1;
      text-transform: uppercase;
    }

    .swiss-header h2 {
      overflow: hidden;
      margin: 0;
      color: var(--poster-ink);
      font-family: 'Helvetica Neue', Helvetica, Arial, ui-sans-serif, system-ui, sans-serif;
      font-size: var(--poster-title-size);
      font-weight: 700;
      letter-spacing: -0.045em;
      line-height: 0.98;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .code-body {
      min-height: 220px;
      padding: 30px var(--poster-pad-inline) 36px;
    }

    ::slotted([slot='code']) {
      --ambient-editor-caret-color: oklch(0.205 0.012 65);
      --ambient-editor-font-size: 15px;
      --ambient-editor-gutter-color: oklch(0.49 0.018 70);
      --ambient-editor-gutter-gap: 14px;
      --ambient-editor-highlight-background: oklch(0.78 0.09 88 / 0.24);
      --ambient-editor-line-height: 1.6;
      --ambient-editor-selection-background: oklch(0.61 0.11 252 / 0.22);
      --ambient-editor-text-color: oklch(0.205 0.012 65);
    }

    .swiss-footer {
      display: grid;
      height: var(--poster-footer-height);
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 24px;
      border-top: 1px solid var(--poster-rule);
      padding-inline: var(--poster-pad-inline);
    }

    .swiss-meta {
      display: flex;
      min-width: 0;
      align-items: baseline;
      gap: 10px;
    }

    .swiss-meta:last-child { justify-self: end; }

    .swiss-value {
      overflow: hidden;
      color: var(--poster-ink);
      font-family: 'Helvetica Neue', Helvetica, Arial, ui-sans-serif, system-ui, sans-serif;
      font-size: 12px;
      font-weight: 700;
      line-height: 1;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .swiss-meta:last-child .swiss-value { font-variant-numeric: tabular-nums; }

    @container ambient (max-width: 560px) {
      .shell {
        --poster-header-height: 102px;
        --poster-footer-height: 52px;
        --poster-pad-inline: 18px;
        --poster-title-size: 30px;
        --poster-signal-height: 8px;
      }

      .swiss-header { padding-block: 18px 16px; }
      .swiss-title { max-width: none; gap: 7px; }
      .code-body { padding: 24px 18px 30px; }
      ::slotted([slot='code']) {
        --ambient-editor-font-size: 13px;
        --ambient-editor-gutter-gap: 10px;
      }
      .swiss-footer { gap: 14px; }
      .swiss-meta { display: grid; gap: 4px; }
      .swiss-value { font-size: 11px; }
    }

    @container ambient (min-width: 1100px) {
      .shell {
        --poster-header-height: 126px;
        --poster-pad-inline: 40px;
        --poster-title-size: 52px;
      }
      .code-body { padding-block: 36px 42px; }
      ::slotted([slot='code']) { --ambient-editor-font-size: 16px; }
    }
  `,
} satisfies AmbientDocument

export const compiledSwissPoster = {
  document: swissPosterDocument,
  template: `
    <article class="shell">
      <header class="swiss-header">
        <div class="swiss-title">
          <span class="swiss-label">Title</span>
          <h2><span data-ambient-binding="0"></span></h2>
        </div>
      </header>
      <div class="code-body"><slot name="code"></slot></div>
      <footer class="swiss-footer">
        <div class="swiss-meta">
          <span class="swiss-label">File type</span>
          <span class="swiss-value"><span data-ambient-binding="1"></span></span>
        </div>
        <div class="swiss-meta">
          <span class="swiss-label">Lines</span>
          <span class="swiss-value"><span data-ambient-binding="2"></span></span>
        </div>
      </footer>
    </article>
  `,
  bindings: [
    { id: 0, source: 'title', format: 'plain', fallback: 'Untitled', tooltip: true },
    { id: 1, source: 'fileTypeLabel', format: 'plain', tooltip: false },
    { id: 2, source: 'lineCount', format: 'pad-3', tooltip: false },
  ],
} satisfies CompiledAmbientDocument
