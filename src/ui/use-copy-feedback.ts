import { useEffect, useRef, useState } from 'react'

const copiedFeedbackDurationMs = 2000

export function useCopyFeedback() {
  const [isCopied, setIsCopied] = useState(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
  }, [])

  const resetCopied = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    resetTimerRef.current = null
    setIsCopied(false)
  }

  const showCopied = () => {
    resetCopied()
    setIsCopied(true)
    resetTimerRef.current = setTimeout(() => {
      setIsCopied(false)
      resetTimerRef.current = null
    }, copiedFeedbackDurationMs)
  }

  return { isCopied, resetCopied, showCopied }
}
