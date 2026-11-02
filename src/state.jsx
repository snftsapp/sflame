import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useWalletAuth } from "./auth"
import { verifySflmBurn } from "./burns"
import { MINT, PRICE_SOL, ROUND_MS, START_POT, START_TARGET, TOKEN_DECIMALS, previewWallet, tokensFor } from "./rules"

const GameContext = createContext(null)

const seedBurns = [
  { wallet: "4mQp9sT2aL8kR1nC6dF0eH3", tokens: 5655, sol: 0.475, at: "02:11" },
  { wallet: "9cVb2wE7yU1iO5pA3sD8fG4", tokens: 5952, sol: 0.5, at: "03:00" },
]

export function GameProvider({ children }) {
  const auth = useWalletAuth()
  const [now, setNow] = useState(() => Date.now())
  const [pot] = useState(START_POT)
  const [targetSol, setTargetSol] = useState(START_TARGET)
  const [deadline, setDeadline] = useState(0)
  const [lastWallet, setLastWallet] = useState(previewWallet)
  const [burns, setBurns] = useState(seedBurns)
  const [status, setStatus] = useState("soon")
  const [winner, setWinner] = useState(null)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const remaining = status === "live" ? deadline - now : 0

  useEffect(() => {
    if (status === "live" && remaining <= 0) {
      setStatus("claimable")
      setWinner(lastWallet)
    }
  }, [lastWallet, remaining, status])

  const connected = auth.authenticated && Boolean(auth.address)
  const wallet = auth.address

  const value = useMemo(() => {
    async function burn(signature) {
      if (status !== "live" || !MINT || !signature) return
      if (burns.some((row) => row.signature === signature)) return
      let found
      try {
        found = await verifySflmBurn(signature, MINT)
      } catch {
        return
      }
      const need = BigInt(tokensFor(targetSol)) * 10n ** BigInt(TOKEN_DECIMALS)
      if (!found || found.raw < need) return
      setBurns((list) => [
        { wallet: found.wallet, tokens: found.tokens, sol: targetSol, at: "03:00", signature: found.signature },
        ...list,
      ])
      setLastWallet(found.wallet)
      setWinner(null)
      setStatus("live")
      setTargetSol((current) => current * 1.05)
      setDeadline(Date.now() + ROUND_MS)
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
      burnedTokens: burns.reduce((sum, row) => sum + row.tokens, 0),
      burn,
    }
  }, [auth.login, auth.loginError, auth.logout, auth.ready, burns, connected, lastWallet, pot, remaining, status, targetSol, wallet, winner])

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  return useContext(GameContext)
}
