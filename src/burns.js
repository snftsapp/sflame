import { TOKEN_DECIMALS } from "./rules"

const RPC = "https://solana-rpc.publicnode.com"
const TOKEN_PROGRAMS = new Set(["spl-token", "spl-token-2022"])

export function solscanTx(signature) {
  return `https://solscan.io/tx/${signature}`
}

export function solscanAccount(address) {
  return `https://solscan.io/account/${address}`
}

export async function readSolBalance(address) {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [address, { commitment: "confirmed" }],
    }),
  })
  if (!response.ok) return null
  const body = await response.json()
  const lamports = body.result?.value
  if (typeof lamports !== "number") return null
  return lamports / 1_000_000_000
}

function rawBalance(rows, mint, owner) {
  return (rows ?? [])
    .filter((row) => row.mint === mint && row.owner === owner)
    .reduce((total, row) => total + BigInt(row.uiTokenAmount?.amount ?? "0"), 0n)
}

export function burnsFromTransaction(tx, mint, decimals = TOKEN_DECIMALS) {
  if (!tx || tx.meta?.err || !mint) return []
  const instructions = [
    ...(tx.transaction?.message?.instructions ?? []),
    ...(tx.meta?.innerInstructions ?? []).flatMap((group) => group.instructions ?? []),
  ]
  const scale = 10 ** decimals
  const found = []
  for (const ix of instructions) {
    if (!TOKEN_PROGRAMS.has(ix?.program)) continue
    const type = String(ix.parsed?.type || "").toLowerCase()
    if (type !== "burn" && type !== "burnchecked") continue
    const info = ix.parsed?.info ?? {}
    if (info.mint !== mint || !info.authority) continue
    const amount = info.tokenAmount?.amount ?? info.amount
    if (amount == null) continue
    let raw
    try {
      raw = BigInt(amount)
    } catch {
      continue
    }
    if (raw <= 0n) continue
    const burned = rawBalance(tx.meta.preTokenBalances, mint, info.authority) - rawBalance(tx.meta.postTokenBalances, mint, info.authority)
    if (burned < raw) continue
    found.push({ wallet: info.authority, raw, tokens: Number(raw) / scale })
  }
  return found
}

export async function verifySflmBurn(signature, mint) {
  if (!signature || !mint) return null
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }],
    }),
  })
  if (!response.ok) return null
  const body = await response.json()
  const tx = body.result
  const blockTime = tx?.blockTime
  const nowSec = Date.now() / 1000
  if (typeof blockTime !== "number" || blockTime > nowSec + 30 || nowSec - blockTime > 600) return null
  const burns = burnsFromTransaction(tx, mint)
  if (!burns.length) return null
  const wallet = burns[0].wallet
  if (burns.some((row) => row.wallet !== wallet)) return null
  const raw = burns.reduce((sum, row) => sum + row.raw, 0n)
  return { wallet, raw, tokens: Number(raw) / 10 ** TOKEN_DECIMALS, signature, blockTime }
}
