import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useWalletAuth } from "./auth"
import { readSolBalance, verifySflmBurn } from "./burns"
import { MINT, POT_WALLET, PRICE_SOL, ROUND_MS, START_TARGET, TOKEN_DECIMALS, canResetClock, tokensFor } from "./rules"

const GameContext = createContext(null)

export function GameProvider({ children }) {
  const auth = useWalletAuth()
  const [now, setNow] = useState(() => Date.now())
  const [pot, setPot] = useState(null)
  const [targetSol, setTargetSol] = useState(START_TARGET)
  const [deadline, setDeadline] = useState(0)
  const [lastWallet, setLastWallet] = useState(null)
  const [lastBurnAt, setLastBurnAt] = useState(0)
  const [burns, setBurns] = useState([])
  const [status, setStatus] = useState(MINT ? "open" : "soon")
  const [winner, setWinner] = useState(null)
  const gate = useRef({ status, deadline, lastBurnAt })
  gate.current = { status, deadline, lastBurnAt }

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let stop = false
    async function pull() {
      try {
        const next = await readSolBalance(POT_WALLET)
        if (!stop && next != null) setPot(next)
      } catch {
        // keep the last on-chain read
      }
    }
    pull()
    const id = setInterval(pull, 15000)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [])

  const remaining = status === "live" ? deadline - now : 0

  useEffect(() => {
    if (status === "live" && remaining <= 0 && lastWallet) {
      setStatus("claimable")
      setWinner(lastWallet)
    }
  }, [lastWallet, remaining, status])

  const connected = auth.authenticated && Boolean(auth.address)
  const wallet = auth.address

  const value = useMemo(() => {
    async function burn(signature) {
      if (!MINT || !signature) return
      if (burns.some((row) => row.signature === signature)) return
      const opened = gate.current
      if (!canResetClock(Date.now(), opened.deadline, opened.status)) return
      let found
      try {
        found = await verifySflmBurn(signature, MINT)
      } catch {
        return
      }
      const now = Date.now()
      const current = gate.current
      const need = BigInt(tokensFor(targetSol)) * 10n ** BigInt(TOKEN_DECIMALS)
      const burnAt = found ? found.blockTime * 1000 : 0
      if (!found || found.raw < need || !canResetClock(now, current.deadline, current.status)) return
      if (current.lastBurnAt && burnAt < current.lastBurnAt) return
      setBurns((list) => [
        { wallet: found.wallet, tokens: found.tokens, sol: targetSol, at: "03:00", signature: found.signature },
        ...list,
      ])
      setLastWallet(found.wallet)
      setLastBurnAt(burnAt)
      setWinner(null)
      setStatus("live")
      setTargetSol((currentTarget) => currentTarget * 1.05)
      setDeadline(now + ROUND_MS)
    }

    return {
      now,
      ready: auth.ready,
      connected,
      wallet,
      connect: auth.login,
      disconnect: auth.logout,
      loginError: auth.loginError,
      pot,
      targetSol,
      tokens: tokensFor(targetSol),
      price: PRICE_SOL,
      remaining: Math.max(0, remaining),
      lastWallet,
      burns,
      status,
      winner,
      burnedTokens: burns.reduce((sum, row) => sum + (row.signature ? row.tokens : 0), 0),
      burn,
    }
  }, [auth.login, auth.loginError, auth.logout, auth.ready, burns, connected, lastWallet, pot, remaining, status, targetSol, wallet, winner])

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  return useContext(GameContext)
}
