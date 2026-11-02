import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { FlameStage } from "../components/FlameStage"
import { StackField } from "../components/StackField"
import { FlameMark, UiButton } from "../components/ui"
import { clamp, usePin } from "../pin"
import { formatSol, formatTokens } from "../rules"
import { useGame } from "../state"

const steps = [
  ["01", "Burn", "Pay the exact SFLM quote. Those tokens are destroyed and you become the last burn."],
  ["02", "Reset", "The clock jumps back to 3:00. The next burn costs 5% more SOL."],
  ["03", "Winner", "If the clock ends, that wallet is the winner. The pot wallet sends the SOL."],
]

const stack = [
  ["token", "Token", "Launch on StonkFun", "SFLM launches on StonkFun. The trading pool stays put. Nobody wins that liquidity."],
  ["burn", "Burn", "Quote follows the pool", "Cheap token, more coins. Expensive token, fewer coins. Same SOL pain, then 5% harder."],
  ["pot", "Pot", "SOL sits on its own", "The pot is separate. The winner is the last burner. The pot wallet sends the SOL. It is not the Raydium pool."],
  ["clock", "Clock", "Three minutes, full reset", "The first burn starts the clock. Every later burn sets it back to 3:00."],
  ["claim", "Winner", "Last burn takes it", "When the clock hits zero, that wallet is the winner. The pot wallet sends the SOL."],
]

const lines = [
  "Solana puts the burn onchain,",
  "in front of a live pool.",
  "We launch SFLM on StonkFun,",
  "you sign from your wallet,",
  "and the last burn takes the pot.",
]

const faqs = [
  ["Where does sFlame launch?", "On Solana, through StonkFun. You sign from your wallet. StonkFun is the launch rail. sFlame is the burn game on top."],
  ["What do you win?", "A separate SOL pot. Not the Raydium pool, and not other people’s liquidity. The last wallet to burn before the clock hits zero is the winner, and the pot wallet sends the SOL there."],
  ["How does the clock work?", "The first burn starts a 3 minute clock. Every later burn resets it to 3 minutes. If nobody burns before it ends, that wallet is the winner."],
  ["How many tokens do you burn?", "Enough to equal a SOL target at the pool price. A cheap token means more tokens. An expensive token means fewer. The SOL target rises 5% after every burn."],
  ["Is this live?", "This site is the interface. The timer you can press here runs in the browser so the flow is visible. It does not move SOL yet."],
]

export default function Home() {
  const game = useGame()
  const heroRef = useRef(null)
  const stackRef = useRef(null)
  const oppRef = useRef(null)
  const heroP = usePin(heroRef)
  const stackP = usePin(stackRef)
  const oppP = usePin(oppRef)
  const [open, setOpen] = useState(0)

  const stepCursor = clamp((heroP - 0.58) / 0.4) * steps.length
  const activeStep = Math.min(steps.length - 1, Math.floor(stepCursor))
  const stackCursor = stackP * stack.length
  const activeStack = Math.min(stack.length - 1, Math.floor(stackCursor))

  return (
    <main className="site-main">
      <section className="pin-track hero-track" ref={heroRef}>
        <div className="pin-sticky hero-sticky" data-header-dark={heroP < 0.16 ? "true" : undefined}>
          <span className="frame-pin tl" />
          <span className="frame-pin tr" />
          <span className="frame-pin bl" />
          <span className="frame-pin br" />
          <div className="hero-scene">
            <StackField tone="dark" />
            <div className="machine-stage">
              <FlameStage />
            </div>
            <div className="hero-chart-layer">
              <Chart game={game} />
            </div>
            <div className="hero-copy">
              <h1>
                Last burn.
                <br />
                SOL pot.
              </h1>
              <div className="hero-actions">
                <UiButton to="/dashboard" variant="accent" icon onDark>Explore the Dashboard</UiButton>
                <UiButton to="/flame" variant="secondary" onDark className="keep-case">Enter SFLAME</UiButton>
              </div>
            </div>
            <div className="hero-bottom">
              <div>
                <p className="mono">Launching via StonkFun on Solana as</p>
                <p className="h6">SFLM</p>
              </div>
              <p className="body-smaller hero-mid">
                Burn SFLM. If nobody burns for 3 minutes, the last wallet takes the SOL pot.
              </p>
              <Link to="/#faq" className="news-chip" viewTransition>
                <p className="mono">FAQ</p>
                <p className="body-smaller">What happens when the clock hits zero?</p>
              </Link>
            </div>
          </div>
          <div className="prod-reveal">
            <div className="prod-cols">
              <div className="prod-copy">
                <span className="pin-dot" />
                <h2>SOL that stays busy</h2>
                <p className="body">
                  Burn SFLM, reset the clock, and the last wallet takes the pot. The trading pool stays where it is.
                </p>
              </div>
              <div className="prod-chart-slot">
                <div className="prod-chart-card mobile-only">
                  <Chart game={game} />
                </div>
              </div>
              <div className="prod-steps">
                {steps.map(([n, title, body], index) => {
                  const distance = Math.abs(stepCursor - (index + 0.5))
                  const on = index === activeStep
                  return (
                    <article
                      key={n}
                      className={`prod-step${on ? " is-active" : ""}`}
                      style={{ opacity: clamp(1.05 - distance * 0.55, 0.2, 1) }}
                    >
                      <p className="mono">{n}</p>
                      <h3>{title}</h3>
                      {on && <p className="body prod-step-body">{body}</p>}
                    </article>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pin-track stack-track" ref={stackRef}>
        <div className={`pin-sticky stack-sticky${stackP > 0.26 ? " is-dark" : ""}`} data-header-dark={stackP > 0.26 ? "true" : undefined}>
          <StackField />
          <div className="stack-head">
            <p className="mono eyebrow">The stack</p>
            <h2>Token. Burn. Pot.</h2>
          </div>
          <div className="stack-body">
            <div className="stack-copy">
              {stack.map(([id, kicker, title, body], index) => {
                const distance = Math.abs(stackCursor - (index + 0.5))
                const on = index === activeStack
                return (
                  <article
                    key={id}
                    className={`stack-item${on ? " is-active" : ""}`}
                    style={{
                      opacity: clamp(1.08 - distance * 1.15, 0, 1),
                      transform: `translateY(${(index - activeStack) * 18}px)`,
                      pointerEvents: on ? "auto" : "none",
                    }}
                  >
                    <p className="mono">{kicker}</p>
                    <h3>{title}</h3>
                    <p className="body">{body}</p>
                  </article>
                )
              })}
            </div>
            <div className="stack-visual">
              <FlameMark className="stack-flame" />
            </div>
          </div>
        </div>
      </section>

      <section className="cta-band dark cta-split" data-header-dark="true">
        <StackField tone="dark" />
        <div className="layout-block-inner cta-grid">
          <div>
            <h2>
              Public pot.
              <br />
              Real burns.
            </h2>
            <div className="hero-actions" style={{ marginTop: 28 }}>
              <UiButton to="/dashboard" variant="accent" onDark icon>Explore the Dashboard</UiButton>
              <UiButton to="/flame" variant="secondary" onDark className="keep-case">Enter SFLAME</UiButton>
            </div>
          </div>
          <div className="cta-visual">
            <PotChart game={game} />
          </div>
        </div>
      </section>

      <section className="pin-track opp-track" ref={oppRef}>
        <div className="pin-sticky opp-sticky">
          <StackField tone="shift" />
          <div className="layout-block-inner opp-reveal">
            <div>
              <span className="pin-dot" />
              <p className="mono eyebrow">Why this launch</p>
            </div>
            <div className="opp-lines">
              {lines.map((line, index) => {
                const start = index / lines.length
                const shown = clamp((oppP - start) / (0.72 / lines.length))
                return (
                  <p key={line} className="opp-line" style={{ opacity: 0.16 + shown * 0.84 }}>
                    {line}
                  </p>
                )
              })}
            </div>
            <UiButton to="/flame" variant="secondary" icon className="keep-case">Enter SFLAME</UiButton>
          </div>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="layout-block-inner faq-layout">
          <div>
            <p className="mono eyebrow">FAQ</p>
            <h2>got more questions?</h2>
          </div>
          <div>
            {faqs.map(([q, a], index) => {
              const shown = open === index
              return (
                <div key={q} className={`faq-item${shown ? " open" : ""}`}>
                  <button type="button" onClick={() => setOpen(shown ? -1 : index)}>
                    <strong>
                      <span className="faq-num mono">{String(index + 1).padStart(2, "0")}</span>
                      {q}
                    </strong>
                    <span className="plus" />
                  </button>
                  <p className="answer body">{a}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </main>
  )
}

function PotChart({ game }) {
  let burned = 0
  const quotes = [...game.burns].reverse().map((row) => {
    burned += row.tokens
    return burned
  })
  quotes.push(burned + game.tokens)
  const low = Math.min(...quotes)
  const high = Math.max(...quotes)
  const span = high - low || high || 1
  const width = 320
  const height = 168
  const pad = 14
  const coords = quotes.map((value, index) => {
    const x = quotes.length === 1 ? width / 2 : (index / (quotes.length - 1)) * (width - pad * 2) + pad
    const y = height - pad - ((value - low) / span) * (height - pad * 2)
    return { x, y, value, next: index === quotes.length - 1 }
  })
  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ")
  const area = `${line} L${coords.at(-1).x.toFixed(1)} ${height} L${coords[0].x.toFixed(1)} ${height} Z`

  return (
    <div className="pot-chart">
      <p className="mono">SOL pot</p>
      <p className="chart-value">{game.pot == null ? "—" : formatSol(game.pot)}</p>
      <p className="chart-sub">{game.burns.length ? `${game.burns.length} burns` : "No burns yet"} · next {formatTokens(game.tokens)} SFLM</p>
      <p className="mono pot-chart-caption">SFLM burned</p>
      <svg className="pot-chart-line" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="SFLM burned">
        {[0.25, 0.5, 0.75].map((mark) => (
          <line key={mark} x1="0" x2={width} y1={height * mark} y2={height * mark} stroke="#f3f8f814" />
        ))}
        <path d={area} fill="#69aac133" />
        <path d={line} fill="none" stroke="#b7eef8" strokeWidth="2.4" />
        {coords.map((point, index) => (
          <circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r={point.next ? 4.5 : 3} fill={point.next ? "#b7eef8" : "#69aac1"} />
        ))}
      </svg>
      <div className="pot-chart-key mono">
        <span>Burned</span>
        <span>After next</span>
      </div>
    </div>
  )
}

function Chart({ game }) {
  return (
    <>
      <p className="mono">SOL pot</p>
      <p className="chart-value">{game.pot == null ? "—" : formatSol(game.pot)}</p>
      <p className="mono">Next burn</p>
      <p className="chart-sub">{formatTokens(game.tokens)} SFLM</p>
      <svg className="holdings-chart" viewBox="0 0 320 120" aria-hidden="true">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          points="0,96 36,88 72,90 108,70 144,74 180,52 216,46 252,28 286,32 320,14"
        />
      </svg>
      <div className="chart-cta">
        <UiButton to="/dashboard" variant="secondary" onDark icon>More in Dashboard</UiButton>
      </div>
    </>
  )
}
