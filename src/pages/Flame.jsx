import { useState } from "react"
import { UiButton } from "../components/ui"
import { solscanAccount, solscanTx } from "../burns"
import { POT_WALLET, copyText, formatClock, formatPot, formatSol, formatTokens, shortWallet } from "../rules"
import { useGame } from "../state"

export default function Flame() {
  const game = useGame()
  const [copied, setCopied] = useState(false)
  const [copiedWinner, setCopiedWinner] = useState(false)
  const won = Boolean(game.winner)
  const waiting = game.status === "soon"
  const open = game.status === "open"
  const verified = game.burns.filter((row) => row.signature)
  let action = "Connect to burn"
  if (won) action = "Round over"
  else if (waiting && game.connected) action = "Soon"
  else if (game.connected && game.status === "live") action = "Burn to take the lead"
  else if (open && game.connected) action = "First burn starts the clock"

  function onAction() {
    if (won || waiting) return
    if (!game.connected) game.connect()
  }

  return (
    <main className="site-main is-inner">
      <section className="page-hero layout-block-inner">
        <p className="mono eyebrow">Round 1</p>
        <div className="flame-hero-top">
          <div>
            <h1>sFlame</h1>
            <p className="live-pot-label">
              <span className={`live-dot ${game.status}`} />
              {waiting ? "Soon" : won ? "The winner" : open ? "Open" : "Live pot"}
            </p>
            <p className="flame-pot">{formatPot(game.pot)}</p>
            <button
              type="button"
              className="pot-wallet"
              onClick={async () => {
                const ok = await copyText(POT_WALLET)
                if (!ok) return
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1400)
              }}
            >
              {copied ? "Copied" : shortWallet(POT_WALLET)}
            </button>
            <a className="solscan-link" href={solscanAccount(POT_WALLET)} target="_blank" rel="noreferrer">Solscan</a>
          </div>
          <p className="flame-clock">{waiting ? "Soon" : open ? "03:00" : formatClock(game.remaining)}</p>
        </div>
        <p className="body lede">Last burn wins the pot. Every burn sets the clock back to 3:00.</p>
        <div className="flame-grid">
          <article className="flame-card">
            <p className="mono">{won ? "The winner" : "Last burn"}</p>
            <p className="h4">{waiting || (won ? !game.winner : !game.lastWallet) ? "—" : shortWallet(won ? game.winner : game.lastWallet)}</p>
            {won && (
              <>
                <button
                  type="button"
                  className="winner-address"
                  onClick={async () => {
                    const ok = await copyText(game.winner)
                    if (!ok) return
                    setCopiedWinner(true)
                    window.setTimeout(() => setCopiedWinner(false), 1400)
                  }}
                >
                  {copiedWinner ? "Copied" : game.winner}
                </button>
                <a className="solscan-link" href={solscanAccount(game.winner)} target="_blank" rel="noreferrer">Solscan</a>
              </>
            )}
          </article>
          <article className="flame-card is-accent">
            <p className="mono">Burn now</p>
            <p className="h4">{formatTokens(game.tokens)} SFLM</p>
            <p className="body-smaller">{formatSol(game.targetSol)} SOL opening quote</p>
          </article>
        </div>
        <div className="flame-action">
          <p className="body-smaller">
            {won
              ? `The winner is this wallet. Send ${formatPot(game.pot)} from the pot wallet.`
              : `First burn is ${formatTokens(game.tokens)} SFLM. The transaction burns them directly. The next one costs 5% more SOL.`}
          </p>
          <div className="flame-cta">
            <UiButton variant="accent" onClick={onAction} disabled={won || (waiting && game.connected) || (open && game.connected)}>{action}</UiButton>
          </div>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="layout-block-inner">
          <h2>Burns</h2>
          {waiting ? <p className="body" style={{ marginTop: 28 }}>Round 1 starts when the CA is live.</p> : verified.length === 0 ? <p className="body" style={{ marginTop: 28 }}>No burns yet. The first burn starts the 3:00 clock.</p> : <div className="table-wrap" style={{ marginTop: 28 }}>
            <table className="flame-table">
              <thead>
                <tr>
                  <th>Wallet</th>
                  <th>Burned</th>
                  <th>SOL target</th>
                  <th>Clock reset</th>
                  <th>Solscan</th>
                </tr>
              </thead>
              <tbody>
                {verified.map((row, index) => (
                  <tr key={row.signature} className={index === 0 ? "is-lead" : ""}>
                    <td>{shortWallet(row.wallet)}</td>
                    <td>{formatTokens(row.tokens)} SFLM</td>
                    <td>{formatSol(row.sol)} SOL</td>
                    <td>{row.at}</td>
                    <td><a href={solscanTx(row.signature)} target="_blank" rel="noreferrer">View</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
        </div>
      </section>
    </main>
  )
}
