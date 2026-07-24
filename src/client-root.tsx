import { Outlet } from 'react-router'
import { usePlausiblePageview } from './product-metrics/metrics-client'

export function ClientRoot() {
  usePlausiblePageview()
  return <Outlet />
}
