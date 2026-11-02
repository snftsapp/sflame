import { UiButton } from "../components/ui"
import { POT_WALLET, formatClock, formatSol, formatTokens, shortWallet } from "../rules"
import { useGame } from "../state"

export default function Dashboard() {
  const game = useGame()
  const waiting = game.status === "soon"
  const lead = game.winner || (waiting ? "" : game.lastWallet)
  const rows = [
    ["Pot", `${formatSol(game.pot)} SOL`],
    ["Pot wallet", shortWallet(POT_WALLET)],
    ["Clock", waiting ? "Soon" : formatClock(game.remaining)],
    ["Status", waiting ? "Soon" : game.status],
    [game.winner ? "The winner" : "Last burn", lead ? shortWallet(lead) : "—"],
    ["Next burn", `${formatTokens(game.tokens)} SFLM`],
    ["SOL target", `${formatSol(game.targetSol)} SOL`],
    ["Pool price", `${game.price} SOL`],
    ["Burned so far", waiting ? "—" : `${formatTokens(game.burnedTokens)} SFLM`],
  ]

  return (
    <main className="site-main is-inner">
      <section className="page-hero layout-block-inner">
        <p className="mono eyebrow">Preview</p>
        <h1>The numbers.</h1>
        <p className="body lede">Same round as Flame. Nothing here is on Solana yet.</p>
        <div className="metrics">
          {rows.map(([label, value]) => (
            <article key={label} className="metric">
              <p className="mono">{label}</p>
              <p className="h5">{value}</p>
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
