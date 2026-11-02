import { useEffect, useRef, useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { useLenis } from "lenis/react"
import { shortWallet } from "../rules"
import { useGame } from "../state"
import { StackField } from "./StackField"
import { FlameMark, Logo, UiButton, blurLayer } from "./ui"

const links = [
  { to: "/", label: "Home", end: true },
  { to: "/flame", label: "sFlame" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/#faq", label: "FAQ" },
]

const desktopLinks = links.filter((link) => link.to !== "/")
const CONTRACT = "Soon"
const X_URL = "https://x.com/sFlameapp"

function CopyContract() {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      className="footer-copy"
      onClick={async () => {
        let ok = false
        try {
          await navigator.clipboard.writeText(CONTRACT)
          ok = true
        } catch {
          const area = document.createElement("textarea")
          area.value = CONTRACT
          area.setAttribute("readonly", "")
          area.style.position = "fixed"
          area.style.left = "-9999px"
          document.body.appendChild(area)
          area.select()
          ok = document.execCommand("copy")
          area.remove()
        }
        if (!ok) return
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1400)
      }}
    >
      {copied ? "Copied" : CONTRACT}
    </button>
  )
}

let bootFinished = false

export function Shell({ children }) {
  const game = useGame()
  const location = useLocation()
  const lenis = useLenis()
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useState(location.pathname === "/")
  const [booting, setBooting] = useState(!bootFinished)
  const [veil, setVeil] = useState("idle")
  const firstRoute = useRef(true)
  const footerRef = useRef(null)
  const wordWrapRef = useRef(null)
  const wordRef = useRef(null)

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.classList.toggle("menu-open", open)
    if (!lenis) return
    if (open) lenis.stop()
    else lenis.start()
  }, [open, lenis])

  useEffect(() => {
    if (!lenis) return
    if (firstRoute.current) {
      firstRoute.current = false
      return
    }
    setVeil("cover")
    const hold = window.setTimeout(() => {
      if (location.hash) {
        const target = document.querySelector(location.hash)
        if (target) lenis.scrollTo(target, { offset: -12, duration: 1.05 })
      } else {
        lenis.scrollTo(0, { immediate: true })
      }
      setVeil("hold")
    }, 520)
    const reveal = window.setTimeout(() => setVeil("reveal"), 780)
    const idle = window.setTimeout(() => setVeil("idle"), 1750)
    return () => {
      window.clearTimeout(hold)
      window.clearTimeout(reveal)
      window.clearTimeout(idle)
    }
  }, [location.pathname, location.hash, lenis])

  useLenis(() => {
    const header = 80
    const bandTop = header
    const bandBottom = window.innerHeight * 0.45
    let hit = false
    document.querySelectorAll("[data-header-dark]").forEach((el) => {
      const rect = el.getBoundingClientRect()
      if (rect.bottom > bandTop && rect.top < bandBottom) hit = true
    })
    setDark((prev) => (prev === hit ? prev : hit))

    const footer = footerRef.current
    const wrap = wordWrapRef.current
    const word = wordRef.current
    if (!footer || !wrap || !word) return
    const rect = wrap.getBoundingClientRect()
    const height = Math.max(1, rect.height)
    const progress = Math.min(1, Math.max(0, (window.innerHeight + height * 0.4 - rect.top) / (height * 1.4)))
    footer.style.setProperty("--in", progress.toFixed(4))
  }, [])

  useEffect(() => {
    const wrap = wordWrapRef.current
    const word = wordRef.current
    if (!wrap || !word) return
    const fit = () => {
      word.style.fontSize = "100px"
      const width = word.getBoundingClientRect().width
      if (!width) return
      const target = Math.min(window.innerWidth * 0.94, 1804)
      wrap.style.fontSize = `${(100 * target) / width}px`
      word.style.fontSize = ""
    }
    fit()
    document.fonts?.ready?.then(fit)
    window.addEventListener("resize", fit)
    return () => window.removeEventListener("resize", fit)
  }, [booting])

  const walletLabel = game.connected ? shortWallet(game.wallet) : "Connect"

  return (
    <>
      {booting && (
        <Boot
          onDone={() => {
            bootFinished = true
            setBooting(false)
          }}
        />
      )}
      <div className={`page-veil is-${veil}`} aria-hidden="true">
        <span className="page-veil-line" />
      </div>
      <div className="gradient-bg-light" aria-hidden="true" />
      <StackField tone="light" fixed />
      <div className="site">
        <header className={`site-header ${dark ? "is-dark" : ""}`}>
          <div className="top-blur" aria-hidden="true">
            <span style={blurLayer(1, "50%", "62.5%", "75%", "87.5%")} />
            <span style={blurLayer(2, "62.5%", "75%", "87.5%", "100%")} />
            <span style={blurLayer(4, "75%", "87.5%", "100%", "100%")} />
            <span style={blurLayer(8, "87.5%", "100%", "100%", "100%")} />
          </div>
          <nav className="navbar">
            <NavLink to="/" className="logo" aria-label="sFlame home" viewTransition onClick={() => setOpen(false)}>
              <Logo />
            </NavLink>
            <div className="nav-desktop">
              {desktopLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  viewTransition
                  className={({ isActive }) => `nav-link${isActive && link.to !== "/#faq" ? " active" : ""}`}
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
            <div className="nav-actions">
              <div className="nav-wallet-wrap">
                <UiButton className="nav-wallet" variant="accent" onDark={dark} disabled={!game.ready} onClick={game.connected ? game.disconnect : game.connect}>
                  {walletLabel}
                </UiButton>
                {game.loginError ? <span className="login-error">{game.loginError}</span> : null}
              </div>
              <UiButton className="nav-menu-btn" variant="secondary" onDark={dark} onClick={() => setOpen(true)}>
                Menu
              </UiButton>
            </div>
          </nav>
        </header>

        <div className={`menu-overlay ${open ? "open" : ""}`} role="dialog" aria-modal="true">
          <nav className="navbar">
            <NavLink to="/" className="logo" aria-label="sFlame home" viewTransition onClick={() => setOpen(false)}>
              <Logo />
            </NavLink>
            <div className="nav-actions">
              <div className="nav-wallet-wrap">
                <UiButton variant="accent" onDark disabled={!game.ready} onClick={game.connected ? game.disconnect : game.connect}>
                  {walletLabel}
                </UiButton>
                {game.loginError ? <span className="login-error">{game.loginError}</span> : null}
              </div>
              <UiButton variant="secondary" onDark onClick={() => setOpen(false)}>
                Close
              </UiButton>
            </div>
          </nav>
          <div className="menu-links">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                viewTransition
                onClick={() => setOpen(false)}
                className={({ isActive }) => (isActive && link.to !== "/#faq" ? "active" : "")}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
          <div className="menu-meta mono">
            <span>Token SFLM · Solana · via Pump.fun</span>
            <a href="https://pump.fun" target="_blank" rel="noreferrer">Pump.fun</a>
          </div>
        </div>

        {children}

        <footer className="site-footer site-footer-dark" data-header-dark="true" ref={footerRef}>
          <StackField tone="dark" />
          <div className="layout-block-inner">
            <div className="footer-top">
              <Logo height={32} />
              <UiButton
                variant="secondary"
                onDark
                onClick={() => (lenis ? lenis.scrollTo(0, { duration: 1.35 }) : window.scrollTo({ top: 0, behavior: "smooth" }))}
              >
                Back to top
              </UiButton>
            </div>
            <div className="footer-grid">
              <div className="footer-brand">
                <p className="mono">Token</p>
                <p className="h6">SFLM via Pump.fun on Solana</p>
              </div>
              <div className="footer-col">
                <h3>Navigation</h3>
                {links.map((link) => (
                  <NavLink key={link.to} to={link.to} viewTransition>{link.label}</NavLink>
                ))}
              </div>
              <div className="footer-col">
                <h3>Play</h3>
                <NavLink to="/flame" viewTransition>Enter SFLAME</NavLink>
                <NavLink to="/dashboard" viewTransition>Dashboard</NavLink>
              </div>
              <div className="footer-col">
                <h3>Launch</h3>
                <a href="https://pump.fun" target="_blank" rel="noreferrer">Pump.fun</a>
              </div>
              <div className="footer-col">
                <h3>X</h3>
                <a href={X_URL} target="_blank" rel="noreferrer">sFlame</a>
              </div>
              <div className="footer-col">
                <h3>CA</h3>
                <CopyContract />
              </div>
            </div>
            <div className="footer-bottom body-smaller">
              <span>SFLM · Solana · via Pump.fun</span>
            </div>
          </div>
          <div className="footer-wordmark-wrap" ref={wordWrapRef} aria-hidden="true">
            <span className="footer-wordmark" ref={wordRef}>sFlame</span>
          </div>
        </footer>
      </div>
    </>
  )
}

function Boot({ onDone }) {
  const fillRef = useRef(null)
  const countRef = useRef(null)
  const doneRef = useRef(onDone)
  const [phase, setPhase] = useState("in")
  doneRef.current = onDone

  useEffect(() => {
    document.body.classList.add("is-booting")
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) {
      if (fillRef.current) fillRef.current.style.transform = "scaleX(1)"
      if (countRef.current) countRef.current.textContent = "100"
      const done = window.setTimeout(() => {
        document.body.classList.remove("is-booting")
        doneRef.current()
      }, 280)
      return () => {
        window.clearTimeout(done)
        document.body.classList.remove("is-booting")
      }
    }
    const start = performance.now()
    let frame = 0
    let shown = -1
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 2680)
      const eased = t * t * t * (t * (t * 6 - 15) + 10)
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${eased})`
      const next = Math.round(eased * 100)
      if (next !== shown && countRef.current) {
        shown = next
        countRef.current.textContent = String(next).padStart(2, "0")
      }
      if (t < 1) {
        frame = requestAnimationFrame(tick)
        return
      }
      setPhase("out")
      window.setTimeout(() => {
        document.body.classList.remove("is-booting")
        doneRef.current()
      }, 820)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      document.body.classList.remove("is-booting")
    }
  }, [])

  return (
    <div className={`boot ${phase}`} aria-hidden="true">
      <span className="boot-glow" />
      <span className="boot-pin tl" />
      <span className="boot-pin tr" />
      <span className="boot-pin bl" />
      <span className="boot-pin br" />
      <div className="boot-core">
        <FlameMark className="boot-mark" />
        <h1 className="boot-word">sFlame</h1>
        <div className="boot-progress">
          <div className="boot-bar">
            <span className="boot-fill" ref={fillRef} />
          </div>
          <p className="boot-count mono" ref={countRef}>00</p>
        </div>
      </div>
    </div>
  )
}
