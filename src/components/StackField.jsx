import { useEffect, useRef } from "react"

export function StackField({ tone = "auto", fixed = false }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const context = canvas.getContext("2d")
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const parent = canvas.parentElement
    const specks = Array.from({ length: 42 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.8 + Math.random() * 2.4,
      speed: 0.035 + Math.random() * 0.05,
      drift: (Math.random() - 0.5) * 0.02,
      alpha: 0.22 + Math.random() * 0.5,
    }))
    const blooms = [
      { x: 0.72, y: 0.42, r: 0.28, phase: 0.4 },
      { x: 0.18, y: 0.7, r: 0.22, phase: 2.1 },
      { x: 0.84, y: 0.78, r: 0.16, phase: 4.2 },
    ]

    let width = 0
    let height = 0
    let frame = 0
    let visible = true
    let last = 0

    const fit = () => {
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    const paint = (time) => {
      context.clearRect(0, 0, width, height)
      const dark = tone === "dark" || (tone === "auto" && parent?.classList.contains("is-dark"))
      const seconds = time / 1000
      const onDark = (y) => (tone === "shift" ? y < 0.5 : dark)
      blooms.forEach((bloom) => {
        const x = (bloom.x + Math.sin(seconds * 0.18 + bloom.phase) * 0.04) * width
        const y = (bloom.y + Math.cos(seconds * 0.14 + bloom.phase) * 0.03) * height
        const radius = bloom.r * Math.min(width, height)
        const glow = context.createRadialGradient(x, y, 0, x, y, radius)
        glow.addColorStop(0, onDark(bloom.y) ? "rgba(105, 170, 193, 0.22)" : "rgba(105, 170, 193, 0.28)")
        glow.addColorStop(1, "rgba(105, 170, 193, 0)")
        context.fillStyle = glow
        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fill()
      })
      const step = last ? Math.min(0.05, (time - last) / 1000) : 0.016
      last = time
      specks.forEach((speck) => {
        if (!reduced) {
          speck.y -= speck.speed * step
          speck.x += speck.drift * step
          if (speck.y < -0.04) {
            speck.y = 1.04
            speck.x = Math.random()
          }
          if (speck.x < -0.04) speck.x = 1.04
          if (speck.x > 1.04) speck.x = -0.04
        }
        const flicker = reduced ? 1 : 0.65 + Math.sin(seconds * 1.6 + speck.x * 12) * 0.35
        context.fillStyle = onDark(speck.y)
          ? `rgba(183, 238, 248, ${speck.alpha * flicker})`
          : `rgba(18, 92, 118, ${speck.alpha * 0.55 * flicker})`
        context.beginPath()
        context.arc(speck.x * width, speck.y * height, speck.r, 0, Math.PI * 2)
        context.fill()
      })
    }

    const draw = (time) => {
      if (!visible) {
        frame = 0
        return
      }
      paint(time)
      frame = reduced ? 0 : requestAnimationFrame(draw)
    }

    fit()
    const resize = new ResizeObserver(fit)
    resize.observe(canvas)
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible && !frame) frame = requestAnimationFrame(draw)
    })
    seen.observe(canvas)
    frame = requestAnimationFrame(draw)

    return () => {
      visible = false
      cancelAnimationFrame(frame)
      resize.disconnect()
      seen.disconnect()
    }
  }, [tone])

  return <canvas ref={ref} className={fixed ? "live-field is-fixed" : "live-field"} aria-hidden="true" />
}
