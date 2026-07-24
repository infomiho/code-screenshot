import { Outlet } from 'react-router'
import { usePlausiblePageview } from './product-metrics/plausible'

export function ClientRoot() {
  usePlausiblePageview()
  return <Outlet />
}
