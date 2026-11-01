import { useState, type ReactNode } from 'react'
import { useAccount, useSwitchChain, useWriteContract } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { toast } from 'sonner'
import { BaseError, type Abi } from 'viem'
import { publicClient, spanChain, txUrl } from '../span/chain'
import { navigate } from '../router'
import { SpanLogo } from '../dep/SpanLogo'
import '../dep/app.css'

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <header className="top top--app">
        <a className="wordmark" href="/" onClick={(e) => (e.preventDefault(), navigate('/'))}>
          <SpanLogo size={24} /> Span
        </a>
        <ConnectKitButton.Custom>
          {({ isConnected, show, truncatedAddress }) => (
            <button className="btn btn--ghost" onClick={show}>
              {isConnected ? truncatedAddress : 'Connect wallet'}
            </button>
          )}
        </ConnectKitButton.Custom>
      </header>
      <main className="app__main">{children}</main>
    </div>
  )
}

type Call = { address: `0x${string}`; abi: Abi; functionName: string; args?: readonly unknown[] }

export function useTx() {
  const { chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const [busy, setBusy] = useState<string | null>(null)

  async function run(label: string, calls: Call[]) {
    setBusy(label)
    try {
      if (chainId !== spanChain.id) await switchChainAsync({ chainId: spanChain.id })
      let last: `0x${string}` | undefined
      for (const call of calls) {
        last = await writeContractAsync({ ...call, chainId: spanChain.id })
        await publicClient.waitForTransactionReceipt({ hash: last })
      }
      toast.success(label, {
        action: last ? { label: 'View', onClick: () => window.open(txUrl(last), '_blank', 'noopener') } : undefined,
      })
      return last
    } catch (err) {
      const msg = err instanceof BaseError ? err.shortMessage : err instanceof Error ? err.message : String(err)
      toast.error(msg)
      return undefined
    } finally {
      setBusy(null)
    }
  }

  return { run, busy }
}
