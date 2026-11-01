import { useEffect, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { decodeEventLog, keccak256, parseUnits, toBytes, zeroAddress, isAddress } from 'viem'
import { toast } from 'sonner'
import { Shell, useTx } from './shared'
import { SPAN_ADDRESS, USDC_ADDRESS, publicClient } from '../span/chain'
import { erc20Abi, spanAbi } from '../span/abi'
import { buildShareLink } from '../lib/share'
import { Flap } from '../dep/Flap'

function defaultViewing() {
  const d = new Date(Date.now() + 2 * 24 * 3600 * 1000)
  d.setMinutes(0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
}

export default function OpenSpan() {
  const { address, isConnected } = useAccount()
  const { run, busy } = useTx()
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [viewing, setViewing] = useState(defaultViewing)
  const [guest, setGuest] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])

  const raw = useMemo(() => {
    try {
      return amount ? parseUnits(amount, 6) : 0n
    } catch {
      return 0n
    }
  }, [amount])
  const when = new Date(viewing).getTime()
  const guestOk = guest === '' || isAddress(guest)
  const ready = isConnected && title.trim().length > 2 && raw > 0n && when > nowMs + 60_000 && guestOk

  async function submit() {
    if (!address) return
    const allowance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [address, SPAN_ADDRESS],
    })
    const calls = []
    if (allowance < raw) calls.push({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [SPAN_ADDRESS, raw] })
    calls.push({
      address: SPAN_ADDRESS,
      abi: spanAbi,
      functionName: 'open',
      args: [raw, BigInt(Math.floor(when / 1000)), guest ? (guest as `0x${string}`) : zeroAddress, keccak256(toBytes(title.trim()))],
    })
    const hash = await run('Span opened', calls)
    if (!hash) return
    const receipt = await publicClient.getTransactionReceipt({ hash })
    for (const log of receipt.logs) {
      try {
        const ev = decodeEventLog({ abi: spanAbi, data: log.data, topics: log.topics })
        if (ev.eventName === 'Opened') {
          setLink(await buildShareLink(`/s/${ev.args.id}?t=${encodeURIComponent(title.trim())}`))
          return
        }
      } catch {
        /* not ours */
      }
    }
  }

  if (link)
    return (
      <Shell>
        <section className="panel panel--done">
          <h1 className="display display--s">Your bond is locked.</h1>
          <p>Send this link to your guest. When they pay, the deposit sits next to your bond until the viewing.</p>
          <div className="share">
            <code>{link}</code>
            <button className="btn" onClick={() => void navigator.clipboard.writeText(link).then(() => toast.success('Link copied'))}>
              Copy link
            </button>
          </div>
        </section>
      </Shell>
    )

  return (
    <Shell>
      <section className="panel">
        <Flap text="CHECK-IN" tone="amber" className="panel__flap" />
        <h1 className="display display--s">Open a Span</h1>
        <p className="panel__lede">
          You lock a bond the same size as the deposit. If you back out, your guest gets both. If they back out, you keep
          their deposit.
        </p>
        <label className="field">
          <span>What is the deposit for?</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Room in Arroios, Lisbon" maxLength={120} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Deposit</span>
            <div className="field__suffix">
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(',', '.'))} placeholder="1.00" />
              <em>USDC</em>
            </div>
          </label>
          <label className="field">
            <span>Viewing or handover</span>
            <input type="datetime-local" value={viewing} onChange={(e) => setViewing(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Guest wallet, if you already know it</span>
          <input value={guest} onChange={(e) => setGuest(e.target.value.trim())} placeholder="Leave empty so anyone with the link can pay" />
          {!guestOk && <small className="field__error">That isn’t a wallet address.</small>}
        </label>
        <div className="sum">
          <span>You lock now</span>
          <b>{amount || '0'} USDC</b>
        </div>
        <button className="btn btn--wide" disabled={!ready || !!busy} onClick={() => void submit()}>
          {busy ? 'Locking your bond…' : isConnected ? 'Lock bond and get link' : 'Connect a wallet first'}
        </button>
      </section>
    </Shell>
  )
}
