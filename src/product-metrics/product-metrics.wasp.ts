import { api, apiNamespace, type Spec } from '@wasp.sh/spec'

import {
  productMetricsMiddleware,
  proxyProductMetrics,
} from './product-metrics-api' with { type: 'ref' }

export const productMetricsSpec: Spec = [
  api('POST', '/pulse', proxyProductMetrics, {
    auth: false,
  }),
  apiNamespace('/pulse', { middlewareConfigFn: productMetricsMiddleware }),
]
