import { IconCheck } from '@tabler/icons-react'
import type { ReactNode } from 'react'

type CopyFeedbackLabelProps = {
  children: ReactNode
  isCopied: boolean
}

export function CopyFeedbackLabel({ children, isCopied }: CopyFeedbackLabelProps) {
  return (
    <span className="copy-feedback-label">
      <span className="copy-feedback-state" aria-hidden={isCopied} data-visible={!isCopied}>
        {children}
      </span>
      <span className="copy-feedback-state" aria-hidden={!isCopied} data-visible={isCopied}>
        <IconCheck className="copy-feedback-check" aria-hidden="true" />
        Copied
      </span>
      <span className="sr-only" role="status">
        {isCopied ? 'Copied to clipboard' : ''}
      </span>
    </span>
  )
}
