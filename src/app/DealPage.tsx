import { useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { formatUnits, keccak256, toBytes } from 'viem'
import { Shell, useTx } from './shared'
import { SPAN_ADDRESS, USDC_ADDRESS, addressUrl, publicClient, short } from '../span/chain'
import { STATUS, erc20Abi, spanAbi } from '../span/abi'

type Deal = {
  host: `0x${string}`
  guest: `0x${string}`
  allowedGuest: `0x${string}`
  amount: bigint
  viewingAt: bigint
  status: number
  ref: `0x${string}`
}
type Stats = readonly [number, number, number, number]

const DAY = 24 * 3600
const fmt = (raw: bigint) => Number(formatUnits(raw, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
const when = (s: bigint) =>
  new Date(Number(s) * 1000).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function DealPage({ id, title }: { id: bigint; title: string | null }) {
  const { address } = useAccount()
  const { run, busy } = useTx()
  const [deal, setDeal] = useState<Deal | null>(null)
  const [hostStats, setHostStats] = useState<Stats | null>(null)
  const [credit, setCredit] = useState(0n)
  const [missing, setMissing] = useState(false)
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))

  const load = useCallback(async () => {
    try {
      const d = (await publicClient.readContract({ address: SPAN_ADDRESS, abi: spanAbi, functionName: 'getDeal', args: [id] }))
      setDeal(d)
      setHostStats(await publicClient.readContract({ address: SPAN_ADDRESS, abi: spanAbi, functionName: 'stats', args: [d.host] }))
    } catch {
      setMissing(true)
    }
    if (address) setCredit(await publicClient.readContract({ address: SPAN_ADDRESS, abi: spanAbi, functionName: 'credits', args: [address] }))
  }, [id, address])

  useEffect(() => {
    const first = setTimeout(() => void load(), 0)
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 15_000)
    return () => {
      clearTimeout(first)
      clearInterval(t)
    }
  }, [load])

  const act = (label: string, functionName: string, args: readonly unknown[] = [id]) => {
    void run(label, [{ address: SPAN_ADDRESS, abi: spanAbi, functionName, args }]).then(load)
  }

  if (missing)
    return (
      <Shell>
        <section className="panel">
          <h1 className="display display--s">This Span doesn’t exist.</h1>
          <p>Check the link with the person who sent it. Span numbers start at 1.</p>
        </section>
      </Shell>
    )
  if (!deal) return <Shell><section className="panel panel--loading" aria-busy="true" /></Shell>

  const me = address?.toLowerCase()
  const isHost = me === deal.host.toLowerCase()
  const isGuest = me === deal.guest.toLowerCase()
  const titleOk = title !== null && keccak256(toBytes(title)) === deal.ref
  const v = deal.viewingAt
  const n = BigInt(now)
  const amt = fmt(deal.amount)
  const dbl = fmt(deal.amount * 2n)
  const before = n < v
  const inWindow = n >= v && n < v + BigInt(DAY)
  const afterWindow = n >= v + BigInt(DAY)

  const pay = () => void payDeposit()

  async function payDeposit() {
    if (!address) return
    const allowance = await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'allowance', args: [address, SPAN_ADDRESS] })
    const calls = []
    if (allowance < deal!.amount) calls.push({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [SPAN_ADDRESS, deal!.amount] })
    calls.push({ address: SPAN_ADDRESS, abi: spanAbi, functionName: 'pay', args: [id] })
    await run('Deposit locked', calls)
    await load()
  }

  const step = (done: boolean, active: boolean) => `step${done ? ' step--done' : ''}${active ? ' step--now' : ''}`

  return (
    <Shell>
      <section className="deal">
        <div className="deal__head">
          <p className="deal__no">Span {id.toString()}</p>
          <h1 className="display display--s">{titleOk ? title : 'Holding deposit'}</h1>
          {title !== null && !titleOk && <p className="warn">The description in this link was changed after the Span was opened. Ask the host for the original link.</p>}
          <p className="deal__host">
            Host <a href={addressUrl(deal.host)} target="_blank" rel="noopener noreferrer">{short(deal.host)}</a>
            {hostStats && (
              <span>
                {hostStats[0]} completed, {hostStats[1]} walked away, {hostStats[3]} disputes
              </span>
            )}
          </p>
        </div>

        <div className="deal__amount">
          <b>{amt}</b>
          <span>USDC deposit</span>
          <p>The host has already locked {amt} USDC as a bond.</p>
        </div>

        <ol className="steps">
          <li className={step(true, deal.status === 0)}>
            <b>Host locks the bond</b>
            <span>{amt} USDC</span>
          </li>
          <li className={step(deal.status > 0, deal.status === 0)}>
            <b>Guest pays the deposit</b>
            <span>{deal.status === 0 ? 'Waiting' : short(deal.guest)}</span>
          </li>
          <li className={step(!before || deal.status === 3, deal.status === 1 && before)}>
            <b>Viewing</b>
            <span>{when(v)}</span>
          </li>
          <li className={step(deal.status === 3, deal.status === 1 && !before)}>
            <b>Paid out</b>
            <span>{deal.status === 2 ? 'Disputed' : `auto after ${when(v + BigInt(DAY))}`}</span>
          </li>
        </ol>

        <div className="rules">
          <p><b>If the guest backs out before the viewing</b> the host keeps the deposit.</p>
          <p><b>If the host backs out</b> the guest gets {dbl} USDC.</p>
          <p><b>If they disagree</b> both get back what they put in after 7 days, unless they agree a split first.</p>
        </div>

        <div className="deal__actions">
          <p className="deal__status">{STATUS[deal.status] ?? ''}</p>
          {deal.status === 0 && !isHost && (
            <button className="btn btn--wide" disabled={!address || !!busy || !before} onClick={pay}>
              {!address ? 'Connect a wallet to pay' : busy ?? `Pay ${amt} USDC deposit`}
            </button>
          )}
          {deal.status === 0 && isHost && (
            <button className="btn btn--ghost" disabled={!!busy} onClick={() => act('Span cancelled', 'cancel')}>
              Cancel and take my bond back
            </button>
          )}
          {deal.status === 1 && isGuest && (
            <>
              <button className="btn btn--wide" disabled={!!busy} onClick={() => act('Handover confirmed', 'confirm')}>
                I got what I paid for. Release to host
              </button>
              {before && (
                <button className="btn btn--ghost" disabled={!!busy} onClick={() => act('You walked away', 'guestWalkAway')}>
                  I’m backing out. Host keeps my deposit
                </button>
              )}
              {inWindow && (
                <button className="btn btn--ghost" disabled={!!busy} onClick={() => act('Dispute opened', 'dispute')}>
                  Something’s wrong. Freeze the money
                </button>
              )}
            </>
          )}
          {deal.status === 1 && isHost && (
            <button className="btn btn--ghost" disabled={!!busy} onClick={() => act('You walked away', 'hostWalkAway')}>
              I can’t go through with it. Guest gets {dbl} USDC
            </button>
          )}
          {deal.status === 1 && afterWindow && (
            <button className="btn btn--wide" disabled={!!busy} onClick={() => act('Released to host', 'release')}>
              Release to host
            </button>
          )}
          {deal.status === 2 && (isHost || isGuest) && (
            <button className="btn btn--ghost" disabled={!!busy} onClick={() => act('Split proposed', 'proposeSplit', [id, deal.amount / 2n])}>
              Propose a 50/50 split of the deposit
            </button>
          )}
          {deal.status === 2 && n >= v + BigInt(DAY * 8) && (
            <button className="btn btn--ghost" disabled={!!busy} onClick={() => act('Refunded both sides', 'timeout')}>
              Return everyone’s money
            </button>
          )}
          {credit > 0n && (
            <button className="btn btn--wide btn--usdc" disabled={!!busy} onClick={() => act('Withdrawn', 'withdraw', [])}>
              Withdraw {fmt(credit)} USDC to my wallet
            </button>
          )}
        </div>
        <p className="deal__contract">
          Held by <a href={addressUrl(SPAN_ADDRESS)} target="_blank" rel="noopener noreferrer">{short(SPAN_ADDRESS)}</a> on Arc. No one, including us, can move it outside these rules.
        </p>
      </section>
    </Shell>
  )
}
