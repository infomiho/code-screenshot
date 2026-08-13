import type { ReactNode } from 'react'

type WorkspaceTaskCardProps = {
  actions?: ReactNode
  content?: ReactNode
  description?: string
  footer?: ReactNode
  heading: string
  meta?: string
}

export function WorkspaceTaskCard({
  actions,
  content,
  description,
  footer,
  heading,
  meta,
}: WorkspaceTaskCardProps) {
  return (
    <section className="workspace-card workspace-task-card" aria-labelledby="workspace-task-heading">
      <h2 id="workspace-task-heading">{heading}</h2>
      {description && <p>{description}</p>}
      {content}
      {actions && <div className="workspace-task-actions">{actions}</div>}
      {meta && <p className="workspace-task-meta">{meta}</p>}
      {footer && <div className="workspace-task-footer">{footer}</div>}
    </section>
  )
}
