import { action, page, query, route, type Spec } from '@wasp.sh/spec'

import { AdminPage } from './AdminPage' with { type: 'ref' }
import {
  getAdminAccess,
  getAdminDashboard,
  getAdminPlausibleSnapshot,
  refreshAdminPlausibleSnapshot,
} from './admin-operations' with { type: 'ref' }

export const adminSpec: Spec = [
  route('AdminRoute', '/admin', page(AdminPage, { authRequired: true })),
  query(getAdminAccess),
  query(getAdminDashboard, { entities: ['User', 'Ambient'] }),
  query(getAdminPlausibleSnapshot),
  action(refreshAdminPlausibleSnapshot),
]
