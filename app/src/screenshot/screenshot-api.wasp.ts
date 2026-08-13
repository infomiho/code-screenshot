import { api, type Spec } from '@wasp.sh/spec'

import {
  getScreenshotCapabilities,
  renderScreenshot,
  resolveScreenshotTheme,
  screenshotApiMiddleware,
} from './screenshot-api' with { type: 'ref' }

export const screenshotApiSpec: Spec = [
  api('GET', '/v1/capabilities', getScreenshotCapabilities, { auth: false }),
  api('GET', '/v1/themes/resolve', resolveScreenshotTheme, {
    auth: false,
    entities: ['Ambient', 'AmbientVersion'],
  }),
  api('POST', '/v1/screenshots', renderScreenshot, {
    auth: false,
    entities: ['Ambient', 'AmbientVersion'],
    middlewareConfigFn: screenshotApiMiddleware,
  }),
]
