export const ROUND_MS = 3 * 60 * 1000
export const PRICE_SOL = 0.000084
export const START_TOKENS = 50_000
export const START_TARGET = 4.2
export const START_POT = 10
export const POT_WALLET = "SFLMNZ7aKA24zz9ARBrZvT3CRLfA5QxUKfcpYmoHy3Q"
export const MINT = "GSRvFNow1pbuQL87oR7XwdNEE5SoEGGMynrKuUqqpump"
export const TOKEN_DECIMALS = 6

export const previewWallet = "7kF3xR2pL9qA8mN4cD1eW6tY5uI0oP3aB2cV8dE9fG1"

export function shortWallet(address) {
  if (!address) return "—"
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

export function canResetClock(now, deadline, status) {
  if (status === "claimable" || status === "claimed") return false
  return !deadline || now < deadline
}

export async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    try {
      const area = document.createElement("textarea")
      area.value = value
      area.setAttribute("readonly", "")
      area.style.position = "fixed"
      area.style.left = "-9999px"
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand("copy")
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}

export function tokensFor(targetSol) {
  if (targetSol === START_TARGET) return START_TOKENS
  return Math.ceil(targetSol / PRICE_SOL)
}

export function formatPot(value) {
  if (value == null || Number.isNaN(value)) return "—"
  return `${formatSol(value)} SOL`
}

export function formatSol(value) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: value >= 1 ? 2 : 3,
    maximumFractionDigits: value >= 1 ? 2 : 4,
  })
}

export function formatTokens(value) {
  return Math.round(value).toLocaleString("en-US")
}

export function formatClock(ms) {
  const safe = Math.max(0, ms)
  const total = Math.min(180, Math.ceil(safe / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}
