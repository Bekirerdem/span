import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { formatUnits } from 'viem'
import { Board, type BoardRow, type Col } from '../Board'
import { SceneHead } from '../SceneHead'
import type { Tone } from '../Flap'
import { SPAN_ADDRESS, addressUrl, publicClient, short } from '../../span/chain'
import { spanAbi } from '../../span/abi'
import { ScrollTrigger, riseOnEnter, useFlow } from '../scroll'

type Live = { id: bigint; amount: bigint; status: number; viewingAt: bigint }
type State = { rows: Live[]; total: number } | 'error' | null

const LIMIT = 24n
const STATUS_WORD = ['OPEN', 'LOCKED', 'DISPUTED', 'CLOSED'] as const
const STATUS_TONE: Tone[] = ['green', 'amber', 'red', 'ivory']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const COLS: Col[] = [
  { key: 'id', label: 'Span', w: 6 },
  { key: 'dep', label: 'Deposit', w: 14, align: 'right' },
  { key: 'status', label: 'Status', w: 8 },
  { key: 'view', label: 'Viewing', w: 12 },
]
const MESSAGE_COLS: Col[] = [{ key: 'msg', label: 'Status', w: 26 }]

const two = (n: number) => String(n).padStart(2, '0')
const viewing = (s: bigint) => {
  const d = new Date(Number(s) * 1000)
  return `${two(d.getDate())} ${MONTHS[d.getMonth()]} ${two(d.getHours())}:${two(d.getMinutes())}`
}
const deposit = (raw: bigint) => `${Number(formatUnits(raw, 6)).toLocaleString('en-US', { maximumFractionDigits: 2 })} USDC`

async function readBoard(): Promise<{ rows: Live[]; total: number }> {
  const next = await publicClient.readContract({ address: SPAN_ADDRESS, abi: spanAbi, functionName: 'nextId' })
  const total = Number(next - 1n)
  const first = next - 1n > LIMIT ? next - LIMIT : 1n
  const ids: bigint[] = []
  for (let id = next - 1n; id >= first; id--) ids.push(id)
  const deals = await Promise.all(ids.map((id) => publicClient.readContract({ address: SPAN_ADDRESS, abi: spanAbi, functionName: 'getDeal', args: [id] })))
  return {
    total,
    rows: deals.map((d, i) => ({ id: ids[i], amount: d.amount, status: Number(d.status), viewingAt: d.viewingAt })),
  }
}

export function LiveBoard() {
  const [state, setState] = useState<State>(null)
  const flow = useFlow()
  const section = useRef<HTMLElement>(null)
  const inner = useRef<HTMLDivElement>(null)

  // The board rises in once, when it comes into view (no scrubbed fade, so no empty frames).
  useLayoutEffect(() => {
    const scope = section.current
    const wrap = inner.current
    if (!scope || !wrap || flow) return
    return riseOnEnter(scope, wrap)
  }, [flow])

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const next = await readBoard()
        if (alive) setState(next)
      } catch {
        if (alive) setState((prev) => (prev && prev !== 'error' ? prev : 'error'))
      }
    }
    const first = setTimeout(() => void load(), 0)
    const poll = setInterval(() => void load(), 20_000)
    return () => {
      alive = false
      clearTimeout(first)
      clearInterval(poll)
    }
  }, [])

  // The board changes height when data arrives; keep the pinned scenes' offsets right.
  useEffect(() => {
    ScrollTrigger.refresh()
  }, [state])

  let cols = COLS
  let rows: BoardRow[]
  if (state === null || state === 'error' || state.rows.length === 0) {
    cols = MESSAGE_COLS
    const msg = state === null ? 'READING THE CHAIN' : state === 'error' ? 'CHAIN UNREACHABLE' : 'AWAITING FIRST DEPARTURE'
    rows = [{ id: 'msg', cells: [msg], light: state === 'error' ? 'red' : 'on', tones: [state === 'error' ? 'red' : 'amber'] }]
  } else {
    rows = state.rows.map((r) => ({
      id: r.id.toString(),
      href: `/s/${r.id}`,
      cells: [`#${r.id}`, deposit(r.amount), STATUS_WORD[r.status] ?? 'CLOSED', viewing(r.viewingAt)],
      tones: [undefined, undefined, STATUS_TONE[r.status] ?? 'ivory', undefined],
      light: r.status === 2 ? 'red' : r.status === 3 ? 'off' : 'on',
    }))
  }

  const shown = state && state !== 'error' ? state.rows.length : 0
  const total = state && state !== 'error' ? state.total : 0

  return (
    <section ref={section} className="scene live" id="live">
      <div ref={inner} className="wrap live__inner">
        <SceneHead kicker="LIVE BOARD" title="Live on Arc." lead="Every Span ever opened, read straight from the contract. No owner, no admin key, no fee." />
        <Board
          kicker="DEPARTURES · LIVE"
          label="Every Span on the contract"
          cols={cols}
          rows={rows}
          delay={200}
          rowGap={90}
          footer={
            <>
              <span>
                Contract {short(SPAN_ADDRESS)}
                {total > shown && shown > 0 ? ` · latest ${shown} of ${total}` : ''}
              </span>
              <a href={addressUrl(SPAN_ADDRESS)} target="_blank" rel="noopener noreferrer">
                View on explorer
              </a>
            </>
          }
        />
      </div>
    </section>
  )
}
