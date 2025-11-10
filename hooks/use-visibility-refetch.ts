"use client"

import { useEffect, useRef } from "react"

/**
 * Call the provided callback whenever the tab/window becomes visible or gains focus.
 * Events handled: visibilitychange, focus, pageshow (for bfcache restores)
 * Optional debounceMs to avoid spamming calls when multiple events fire together.
 */
export function useVisibilityRefetch(callback: () => void, debounceMs: number = 0) {
  const cbRef = useRef(callback)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    cbRef.current = callback
  }, [callback])

  useEffect(() => {
    const run = () => {
      // Only run when the document is visible
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return

      if (debounceMs > 0) {
        if (timerRef.current) window.clearTimeout(timerRef.current)
        timerRef.current = window.setTimeout(() => {
          cbRef.current()
        }, debounceMs)
      } else {
        cbRef.current()
      }
    }

    const handleVisibility = () => run()
    const handleFocus = () => run()
    const handlePageShow = (e: PageTransitionEvent) => {
      // Some browsers fire pageshow when restoring from bfcache
      if ((e as any).persisted === true) run();
      else run();
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus)
      window.addEventListener('pageshow', handlePageShow as EventListener)
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility)
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus)
        window.removeEventListener('pageshow', handlePageShow as EventListener)
      }
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [debounceMs])
}
