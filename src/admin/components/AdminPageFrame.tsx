import type { ReactNode } from 'react'

type AdminPageFrameProps = {
  header: ReactNode
  children: ReactNode
  isBusy?: boolean
}

export function AdminPageFrame({ header, children, isBusy = false }: AdminPageFrameProps) {
  return (
    <main className="admin-page" aria-busy={isBusy || undefined}>
      <header className="subpage-header">{header}</header>
      <div className="admin-body">{children}</div>
    </main>
  )
}
