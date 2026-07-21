import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App } from '../../src/app'

describe('App prerender', () => {
  it('renders neutral skeletons instead of guessing theme or account', () => {
    const html = renderToString(createElement(App))

    // The ambient frame stays a neutral skeleton until the client hydrates,
    // so the prerendered markup never commits to a specific theme.
    expect(html).toContain('ambient-skeleton')
    expect(html).toContain('editor-skeleton')
    expect(html).not.toContain('shot-frame--macos')

    // The account control resolves after hydration; the prerender shows a
    // placeholder rather than a sign-in button that would swap for a username.
    expect(html).toContain('account-skeleton')
    expect(html).not.toContain('Sign in with GitHub')
  })
})
