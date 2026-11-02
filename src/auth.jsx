import { createContext, useCallback, useContext, useState } from "react"
import { PrivyProvider, usePrivy } from "@privy-io/react-auth"
import { toSolanaWalletConnectors, useWallets } from "@privy-io/react-auth/solana"

const solanaConnectors = toSolanaWalletConnectors({ shouldAutoConnect: false })

const WalletAuthContext = createContext(null)

const missingAuth = {
  ready: true,
  authenticated: false,
  address: null,
  loginError: null,
  login() {},
  logout() {},
}

function solanaAddress(user, wallets) {
  const connected = wallets.find((wallet) => wallet.address)
  if (connected) return connected.address
  const linked = user?.linkedAccounts?.find(
    (account) => account.type === "wallet" && account.chainType === "solana" && account.address,
  )
  return linked?.address ?? null
}

function phantomProvider() {
  const candidates = [window.phantom?.solana, window.solana]
  return candidates.find((provider) => provider?.isPhantom) ?? null
}

function rejected(error) {
  const message = String(error?.message || "")
  return error?.code === 4001 || /reject|cancel|denied/i.test(message)
}

function PrivyBridge({ children }) {
  const { ready, authenticated, user, login, logout } = usePrivy()
  const wallets = useWallets()
  const [phantomAddress, setPhantomAddress] = useState(null)
  const [loginError, setLoginError] = useState(null)
  const privyAddress = solanaAddress(user, wallets.wallets)
  const address = privyAddress || phantomAddress

  const connect = useCallback(async () => {
    if (!ready) return
    setLoginError(null)
    const provider = phantomProvider()
    if (!provider) {
      login()
      return
    }
    try {
      const { publicKey } = await provider.connect()
      const next = publicKey?.toString?.()
      if (!next) throw new Error("Phantom didn't return an address")
      setPhantomAddress(next)
    } catch (error) {
      if (!rejected(error)) {
        console.error("[sflame] wallet login failed", error?.message || error)
        setLoginError(error?.message || "Could not connect Phantom")
      }
    }
  }, [login, ready])

  const disconnect = useCallback(() => {
    setPhantomAddress(null)
    logout()
    phantomProvider()?.disconnect?.().catch(() => {})
  }, [logout])

  return (
    <WalletAuthContext.Provider
      value={{
        ready: ready && wallets.ready,
        authenticated: authenticated || Boolean(address),
        address,
        loginError,
        login: connect,
        logout: disconnect,
      }}
    >
      {children}
    </WalletAuthContext.Provider>
  )
}

export function AuthProvider({ children }) {
  const appId = import.meta.env.VITE_PRIVY_APP_ID
  if (!appId) {
    return <WalletAuthContext.Provider value={missingAuth}>{children}</WalletAuthContext.Provider>
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["wallet", "email"],
        appearance: {
          theme: "#071013",
          accentColor: "#69aac1",
          walletChainType: "solana-only",
          walletList: ["phantom", "solflare", "backpack", "detected_solana_wallets"],
          showWalletLoginFirst: true,
          landingHeader: "Connect",
          loginMessage: "Solana wallet for sFlame",
        },
        embeddedWallets: {
          solana: {
            createOnLogin: "off",
          },
        },
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
      }}
    >
      <PrivyBridge>{children}</PrivyBridge>
    </PrivyProvider>
  )
}

export function useWalletAuth() {
  const auth = useContext(WalletAuthContext)
  if (!auth) throw new Error("useWalletAuth must be used within AuthProvider")
  return auth
}
