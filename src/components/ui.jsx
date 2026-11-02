import { Link } from "react-router-dom"

const FLAME_BODY =
  "M33.2 4.4C43.7 13.8 53.1 26.6 58 41C61 51.2 58.5 65.8 47.6 74.3C37.2 80.4 23.8 78.9 14.4 70.2C7.4 62.5 4 49.7 8.9 38.4C11.9 31.2 18.9 25.1 22.3 29.2C24.8 33.3 23.3 41 21.3 44.6C24.8 38.4 29.8 24.1 33.2 4.4Z"
const FLAME_TONGUE =
  "M37.7 27.1C46.1 37.9 47.6 52.8 38.7 65.6C32.2 74.3 21.3 73.2 15.4 60.4C13.4 52.2 21.8 43.5 29.8 38.9C33.7 34.8 35.2 30.7 37.7 27.1Z"
const FLAME_CORE =
  "M32.7 45.3C36.7 49.2 37.2 58.9 32.2 67.1C29.3 71.2 25.3 67.6 26.3 58.1C27.8 50.2 30.8 47.1 32.7 45.3Z"

export function FlameMark({ className = "" }) {
  return (
    <svg className={className} viewBox="0 -4 64 98" aria-hidden="true">
      <path fill="#78A8BE" d={FLAME_BODY} />
      <path className="flame-inner" fill="#fff" fillOpacity="0.84" d={FLAME_TONGUE} />
      <path className="flame-core" fill="#fff" d={FLAME_CORE} />
      <circle className="flame-ember" cx="34.7" cy="1" r="2.1" fill="#78A8BE" />
      <circle className="flame-ember" cx="44.2" cy="8.2" r="2.5" fill="#78A8BE" />
      <circle className="flame-ember" cx="18.1" cy="13.8" r="2.3" fill="#78A8BE" />
      <circle className="flame-ember" cx="56.1" cy="27.1" r="1.8" fill="#78A8BE" />
      <circle cx="16" cy="86" r="0.7" fill="#78A8BE" opacity="0.45" />
      <circle cx="50" cy="90" r="0.55" fill="#78A8BE" opacity="0.35" />
      <circle cx="8" cy="78" r="0.45" fill="#9ec4d2" opacity="0.4" />
    </svg>
  )
}

export function Logo({ height = 34 }) {
  return (
    <span className="brand-lockup" style={{ height }}>
      <FlameMark />
      <span>sFlame</span>
    </span>
  )
}

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function UiButton({
  to,
  href,
  onClick,
  children,
  variant = "secondary",
  icon = false,
  onDark = false,
  type = "button",
  className = "",
  disabled = false,
}) {
  const cls = `ui-button ${variant} ${icon ? "has-icon" : ""} ${onDark ? "is-on-dark" : ""} ${className}`.trim()
  const label = typeof children === "string" ? children : undefined
  const inner = (
    <>
      <span className="content" aria-hidden="true">
        <span>{children}</span>
        <span>{children}</span>
      </span>
      {icon && (
        <span className="icon" aria-hidden="true">
          <span><Arrow /></span>
          <span><Arrow /></span>
        </span>
      )}
    </>
  )
  if (to) {
    return (
      <Link className={cls} to={to} viewTransition aria-label={label}>
        {inner}
      </Link>
    )
  }
  if (href) {
    return (
      <a className={cls} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" aria-label={label}>
        {inner}
      </a>
    )
  }
  return (
    <button className={cls} type={type} onClick={onClick} disabled={disabled} aria-label={label}>
      {inner}
    </button>
  )
}

export function blurLayer(amount, a, b, c, d) {
  const mask = `linear-gradient(to top, rgba(0,0,0,0) ${a}, #000 ${b}, #000 ${c}, rgba(0,0,0,0) ${d})`
  return {
    backdropFilter: `blur(${amount}px)`,
    WebkitBackdropFilter: `blur(${amount}px)`,
    maskImage: mask,
    WebkitMaskImage: mask,
  }
}
