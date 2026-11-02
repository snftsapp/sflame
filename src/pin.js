import { useCallback, useState } from "react"
import { useLenis } from "lenis/react"

export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

export function usePin(ref) {
  const [progress, setProgress] = useState(0)

  const onScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const range = Math.max(1, el.offsetHeight - window.innerHeight)
    const next = clamp(-rect.top / range)
    el.style.setProperty("--p", next.toFixed(4))
    const stepped = Math.round(next * 20) / 20
    setProgress((prev) => (prev === stepped ? prev : stepped))
  }, [ref])

  useLenis(onScroll, [onScroll])
  return progress
}
