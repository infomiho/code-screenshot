import { api, type Spec } from '@wasp.sh/spec'

import { renderScreenshot, screenshotApiMiddleware } from './screenshot-api' with { type: 'ref' }

export const screenshotApiSpec: Spec = [
  api('POST', '/v1/screenshots', renderScreenshot, {
    auth: false,
    entities: ['Ambient', 'AmbientVersion'],
    middlewareConfigFn: screenshotApiMiddleware,
  }),
]
