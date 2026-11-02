import { UiButton } from "../components/ui"
import { solscanAccount } from "../burns"
import { MINT, POT_WALLET, formatClock, formatPot, formatSol, formatTokens, shortWallet } from "../rules"
import { useGame } from "../state"

export default function Dashboard() {
  const game = useGame()
  const waiting = game.status === "soon"
  const open = game.status === "open"
  const lead = game.winner || (waiting ? "" : game.lastWallet)
  const rows = [
    ["Pot", formatPot(game.pot)],
    ["Pot wallet", shortWallet(POT_WALLET), solscanAccount(POT_WALLET)],
    ["CA", shortWallet(MINT), solscanAccount(MINT)],
    ["Clock", waiting ? "Soon" : open ? "03:00" : formatClock(game.remaining)],
    ["Status", waiting ? "Soon" : open ? "Open" : game.status],
    [game.winner ? "The winner" : "Last burn", lead ? shortWallet(lead) : "—"],
    ["Next burn", `${formatTokens(game.tokens)} SFLM`],
    ["SOL target", `${formatSol(game.targetSol)} SOL`, null, "What this burn is worth"],
    ["Opening price", `${game.price} SOL`],
    ["Burned so far", waiting ? "—" : `${formatTokens(game.burnedTokens)} SFLM`],
  ]

  return (
    <main className="site-main is-inner">
      <section className="page-hero layout-block-inner">
        <p className="mono eyebrow">Preview</p>
        <h1>The numbers.</h1>
        <p className="body lede">The pot is the wallet balance on Solana. The first burn starts the clock.</p>
        <div className="metrics">
          {rows.map(([label, value, href, note]) => (
            <article key={label} className="metric">
              <p className="mono">{label}</p>
              {href ? (
                <a className="h5 solscan-link" href={href} target="_blank" rel="noreferrer">{value}</a>
              ) : (
                <p className="h5">{value}</p>
              )}
              {note ? <p className="body-smaller">{note}</p> : null}
            </article>
          ))}
        </div>
        <div className="actions">
          <UiButton to="/flame" variant="accent" icon className="keep-case">Enter SFLAME</UiButton>
        </div>
      </section>
    </main>
  )
}
