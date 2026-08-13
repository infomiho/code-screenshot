import { Fragment, useEffect, useState, type CSSProperties } from 'react'
import { IconX } from '@tabler/icons-react'
import './theme-nudge.css'

const themeNudgeDismissedKey = 'codeshot.theme-nudge-dismissed'
const themeNudgeAnimatedKey = 'codeshot.theme-nudge-animated'
const initialTypingDelayMs = 120
const characterTypingDurationMs = 24
const phrasePauseMs = 120
const clausePauseMs = 140
const sentencePauseMs = 220
const themeNudgeActionLabel = 'create a theme'

type ThemeNudgeSentences = readonly [string, ...string[]]

type ThemeNudgeProps = {
  isCreatingTheme: boolean
  onCreateTheme: () => void
  sentences: ThemeNudgeSentences
}

type TypewriterPhrase = {
  kind: 'action' | 'copy'
  text: string
}

type TimedTypewriterPhrase = TypewriterPhrase & {
  characterCount: number
  durationMs: number
  pauseMs: number
  startMs: number
}

type TypewriterSequence = {
  completionMs: number
  phrases: TimedTypewriterPhrase[]
}

type ThemeNudgeMessageProps = Pick<ThemeNudgeProps, 'isCreatingTheme' | 'onCreateTheme'> & {
  sequence: TypewriterSequence
  shouldAnimate: boolean
}

export const editorThemeNudgeSentences = [
  'We are agent-first.',
  'Create a custom theme in 1-2 minutes',
  'by asking your agent:',
] as const satisfies ThemeNudgeSentences

export const sharedThemeNudgeSentences = [
  'Create a custom theme like this',
  'in 1-2 minutes with your agent:',
] as const satisfies ThemeNudgeSentences

const readThemeNudgeState = () => {
  try {
    const isVisible = localStorage.getItem(themeNudgeDismissedKey) !== 'true'
    const canAnimate = matchMedia('(min-width: 721px) and (prefers-reduced-motion: no-preference)').matches
    const shouldAnimate = isVisible && canAnimate && localStorage.getItem(themeNudgeAnimatedKey) !== 'true'
    return { isVisible, shouldAnimate }
  } catch {
    return { isVisible: true, shouldAnimate: false }
  }
}

const markThemeNudgeAnimated = () => {
  try {
    localStorage.setItem(themeNudgeAnimatedKey, 'true')
  } catch {}
}

const getPauseAfter = (text: string) => {
  if (/[.!?]$/.test(text)) return sentencePauseMs
  if (/[,;:]$/.test(text)) return clausePauseMs
  return phrasePauseMs
}

const createTypewriterSequence = (sentences: ThemeNudgeSentences) => {
  const phrases: TypewriterPhrase[] = [
    ...sentences.map((text) => ({ kind: 'copy' as const, text })),
    { kind: 'action', text: themeNudgeActionLabel },
  ]
  let nextStartMs = initialTypingDelayMs
  let completionMs = initialTypingDelayMs

  const timedPhrases = phrases.map((phrase, index): TimedTypewriterPhrase => {
    const characterCount = phrase.text.length
    const durationMs = characterCount * characterTypingDurationMs
    const pauseMs = index === phrases.length - 1 ? 0 : getPauseAfter(phrase.text)
    const timedPhrase = { ...phrase, characterCount, durationMs, pauseMs, startMs: nextStartMs }
    completionMs = nextStartMs + durationMs
    nextStartMs += durationMs + pauseMs
    return timedPhrase
  })

  return { completionMs, phrases: timedPhrases }
}

const getPhraseStyle = (phrase: TimedTypewriterPhrase) => ({
  '--phrase-duration': `${phrase.durationMs + phrase.pauseMs}ms`,
  '--type-delay': `${phrase.startMs}ms`,
  '--type-duration': `${phrase.durationMs}ms`,
  '--type-steps': phrase.characterCount,
  '--type-width': `${phrase.characterCount}ch`,
}) as CSSProperties

const useTypewriterCompletion = (
  shouldAnimate: boolean,
  durationMs: number,
  onComplete: () => void,
) => {
  const [isComplete, setIsComplete] = useState(!shouldAnimate)

  useEffect(() => {
    if (!shouldAnimate) {
      setIsComplete(true)
      return
    }
    setIsComplete(false)
    const timer = setTimeout(() => {
      setIsComplete(true)
      onComplete()
    }, durationMs)
    return () => clearTimeout(timer)
  }, [durationMs, onComplete, shouldAnimate])

  return isComplete
}

function ThemeNudgeMessage({ isCreatingTheme, onCreateTheme, sequence, shouldAnimate }: ThemeNudgeMessageProps) {
  const isTypewriterComplete = useTypewriterCompletion(
    shouldAnimate,
    sequence.completionMs,
    markThemeNudgeAnimated,
  )

  return (
    <p className="theme-nudge-message" data-typewriter-complete={isTypewriterComplete}>
      {sequence.phrases.map((phrase, index) => {
        return (
          <Fragment key={`${index}-${phrase.text}`}>
            <span className="theme-nudge-phrase" style={getPhraseStyle(phrase)}>
              {phrase.kind === 'action' ? (
                <button
                  className="theme-nudge-action"
                  type="button"
                  aria-busy={isCreatingTheme}
                  disabled={isCreatingTheme}
                  onClick={onCreateTheme}
                >
                  {phrase.text}
                </button>
              ) : (
                phrase.text
              )}
            </span>
            {index < sequence.phrases.length - 1 && ' '}
          </Fragment>
        )
      })}
    </p>
  )
}

export function ThemeNudge({ isCreatingTheme, onCreateTheme, sentences }: ThemeNudgeProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const sequence = createTypewriterSequence(sentences)

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
      style={{ '--typewriter-duration': `${sequence.completionMs}ms` } as CSSProperties}
    >
      <ThemeNudgeMessage
        isCreatingTheme={isCreatingTheme}
        onCreateTheme={onCreateTheme}
        sequence={sequence}
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
