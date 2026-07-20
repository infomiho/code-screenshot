import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App } from '../../src/app'

describe('App prerender', () => {
  it('renders an editor skeleton inside the editor host', () => {
    const html = renderToString(createElement(App))

    expect(html).toContain('code-editor-host')
    expect(html).toContain('editor-skeleton')
    expect(html).not.toMatch(/class="code-editor-host"[^>]*><\/div>/)
  })
})
