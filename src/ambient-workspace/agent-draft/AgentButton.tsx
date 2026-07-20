import type { ButtonHTMLAttributes, ReactNode } from 'react'

type AgentButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> & {
  children: ReactNode
  isDisabled?: boolean
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger'
}

export function AgentButton({
  children,
  isDisabled = false,
  variant = 'secondary',
  ...props
}: AgentButtonProps) {
  return (
    <button
      {...props}
      className={`agent-button agent-button-${variant}${props.className ? ` ${props.className}` : ''}`}
      type={props.type ?? 'button'}
      disabled={isDisabled}
    >
      {children}
    </button>
  )
}
