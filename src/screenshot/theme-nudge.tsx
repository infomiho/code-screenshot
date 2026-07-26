import { useEffect, useState } from 'react'
import { IconX } from '@tabler/icons-react'
import './theme-nudge.css'

const themeNudgeDismissedKey = 'codeshot.theme-nudge-dismissed'
const themeNudgeAnimatedKey = 'codeshot.theme-nudge-animated'
const typewriterDurationMs = 1980

const readThemeNudgeState = () => {
  try {
    const isVisible = localStorage.getItem(themeNudgeDismissedKey) !== 'true'
    const canAnimate = matchMedia('(min-width: 721px) and (prefers-reduced-motion: no-preference)').matches
    const shouldAnimate = isVisible && canAnimate && localStorage.getItem(themeNudgeAnimatedKey) !== 'true'
    if (shouldAnimate) localStorage.setItem(themeNudgeAnimatedKey, 'true')
    return { isVisible, shouldAnimate }
  } catch {
    return { isVisible: true, shouldAnimate: false }
  }
}

type ThemeNudgeProps = {
  isCreatingTheme: boolean
  onCreateTheme: () => void
}

const useTypewriterCompletion = (shouldAnimate: boolean) => {
  const [isComplete, setIsComplete] = useState(!shouldAnimate)

  useEffect(() => {
    if (!shouldAnimate) {
      setIsComplete(true)
      return
    }
    setIsComplete(false)
    const timer = setTimeout(() => setIsComplete(true), typewriterDurationMs)
    return () => clearTimeout(timer)
  }, [shouldAnimate])

  return isComplete
}

function ThemeNudgeMessage({ isCreatingTheme, onCreateTheme, shouldAnimate }: ThemeNudgeProps & { shouldAnimate: boolean }) {
  const isTypewriterComplete = useTypewriterCompletion(shouldAnimate)

  return (
    <p className="theme-nudge-message" data-typewriter-complete={isTypewriterComplete}>
      <span className="theme-nudge-phrase theme-nudge-phrase-1">We are agent-first.</span>{' '}
      <span className="theme-nudge-phrase theme-nudge-phrase-2">Create a custom theme in 1-2 minutes</span>{' '}
      <span className="theme-nudge-phrase theme-nudge-phrase-3">
        by asking your agent:{' '}
        <button
          className="theme-nudge-action"
          type="button"
          aria-busy={isCreatingTheme}
          disabled={isCreatingTheme}
          onClick={onCreateTheme}
        >
          create a theme
        </button>
      </span>
    </p>
  )
}

export function ThemeNudge({ isCreatingTheme, onCreateTheme }: ThemeNudgeProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [shouldAnimate, setShouldAnimate] = useState(false)

  useEffect(() => {
    const state = readThemeNudgeState()
    setIsVisible(state.isVisible)
    setShouldAnimate(state.shouldAnimate)
  }, [])

  const dismiss = () => {
    setIsVisible(false)
    try {
      localStorage.setItem(themeNudgeDismissedKey, 'true')
    } catch {}
  }

  if (!isVisible) return null

  return (
    <aside
      className="theme-nudge"
      aria-label="Create your own theme"
      data-animate={shouldAnimate || undefined}
    >
      <ThemeNudgeMessage
        isCreatingTheme={isCreatingTheme}
        onCreateTheme={onCreateTheme}
        shouldAnimate={shouldAnimate}
      />
      <button
        className="theme-nudge-dismiss"
        type="button"
        aria-label="Dismiss create theme suggestion"
        onClick={dismiss}
      >
        <IconX aria-hidden="true" />
      </button>
    </aside>
  )
}
