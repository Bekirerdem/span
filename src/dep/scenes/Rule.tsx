import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Board, type BoardRow, type Col } from '../Board'
import { SceneHead } from '../SceneHead'
import { Count } from '../Count'
import { flipDuration } from '../Flap'
import { UsdcMark } from '../SpanLogo'
import { scrubProgress, setChart, useFlow } from '../scroll'

const COLS: Col[] = [
  { key: 'event', label: 'Event', w: 21 },
  { key: 'pays', label: 'Outcome', w: 10 },
  { key: 'amount', label: 'Amount', w: 10 },
  { key: 'status', label: 'Status', w: 7, status: true },
]

type Outcome = { event: string; pays: string; amount: number | string; extra?: string; status: string }

const OUTCOMES: Outcome[] = [
  { event: 'GUEST CONFIRMS', pays: 'HOST GETS', amount: 900, status: 'ON TIME' },
  { event: 'GUEST BACKS OUT', pays: 'HOST KEEPS', amount: 450, extra: '+ BOND', status: 'ON TIME' },
  { event: 'HOST BACKS OUT', pays: 'GUEST GETS', amount: 900, status: 'DOUBLE' },
  { event: 'NO OBJECTION 24H', pays: 'HOST GETS', amount: 900, status: 'AUTO' },
  { event: 'DISPUTE, NO SPLIT 7D', pays: 'BOTH', amount: 'REFUNDED', status: 'HOLD' },
]
const ROWS = OUTCOMES.length
/** This board flips at most 6 times per tile, 12ms apart, so a row settles quickly. */
const MAX_FLIPS = 6
const STAGGER = 12
/** A row starts when the previous one is in its last two steps. */
const OVERLAP_MS = 90
/** Row n starts at ROW_AT[n]: 5% to 55%, evenly spaced, so even the last row has settled well before 65%. The footnote follows at 72%. */
const ROW_AT = OUTCOMES.map((_, i) => 0.05 + (i * 0.5) / (ROWS - 1))
const FOOT_AT = 0.72

/** How long each row takes to finish flipping: the next row starts only after this. */
const ROW_MS = OUTCOMES.map((o) =>
  Math.round(
    Math.max(
      flipDuration(o.event, COLS[0].w, MAX_FLIPS, STAGGER),
      flipDuration(o.pays, COLS[1].w, MAX_FLIPS, STAGGER),
      typeof o.amount === 'string' ? flipDuration(o.amount, COLS[2].w, MAX_FLIPS, STAGGER) : 0,
      flipDuration(o.status, COLS[3].w, MAX_FLIPS, STAGGER),
    ),
  ),
)

function amountCell(o: Outcome, on: boolean): ReactNode {
  if (typeof o.amount === 'string') return on ? o.amount : ''
  return (
    <span className="amt">
      <UsdcMark size={14} />
      <Count to={o.amount} active={on} duration={0.8} />
      {o.extra && <span className="amt__x">{o.extra}</span>}
    </span>
  )
}

export function Rule() {
  const flow = useFlow()
  const root = useRef<HTMLElement>(null)
  const pin = useRef<HTMLDivElement>(null)
  // `want` follows the scroll; `shown` catches up one finished row at a time.
  const [want, setWant] = useState(0)
  const [shown, setShown] = useState(0)

  useLayoutEffect(() => {
    const scope = root.current
    const el = pin.current
    if (!scope || !el || flow) return
    let lastWant = 0
    // Pacing: rows 1-5 at evenly spaced thresholds between 5% and 65%, the footnote at 72%, then hold to 100%.
    const apply = (p: number) => {
      const rowsDue = ROW_AT.filter((t) => p >= t).length
      const w = rowsDue + (p >= FOOT_AT ? 1 : 0)
      if (w !== lastWant) {
        lastWant = w
        setWant(w)
        setShown((s) => Math.min(s, w))
      }
    }
    const stopPin = scrubProgress(
      el,
      {
        start: 'top top',
        end: '+=200%',
        pin: true,
        debug: { name: 'rule', lastAt: FOOT_AT, content: el },
        // the map is gone by now; make sure the terminal is what sits behind this scene
        extra: { onEnter: () => setChart(false) },
      },
      apply,
    )
    return () => stopPin()
  }, [flow])

  useEffect(() => {
    const el = root.current
    if (!flow || !el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        setWant(ROWS + 1)
      },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [flow])

  // One row at a time: row n+1 starts when row n has finished flipping.
  useEffect(() => {
    if (shown >= want) return
    const wait = shown === 0 ? 0 : Math.max(0, ROW_MS[Math.min(shown, ROWS) - 1] - OVERLAP_MS)
    const t = setTimeout(() => setShown((s) => s + 1), wait)
    return () => clearTimeout(t)
  }, [shown, want])

  const visible = Math.min(shown, want)
  const amounts = useMemo(() => OUTCOMES.map((o) => [amountCell(o, false), amountCell(o, true)] as const), [])

  const rows: BoardRow[] = OUTCOMES.map((o, i) => {
    const on = visible > i
    return {
      id: o.event,
      cells: [on ? o.event : '', on ? o.pays : '', amounts[i][on ? 1 : 0], on ? o.status : ''],
      light: on ? 'on' : 'off',
    }
  })

  return (
    <section ref={root} className={`scene rule${flow ? ' is-flow' : ''}`} id="rule">
      <div ref={pin} className="scene__pin">
        <div className="scene__in">
          <div className="wrap">
            <SceneHead kicker="THE RULE" title="Whoever walks away pays." />
            <div className="grid12 rule__grid">
              <div className="rule__board">
                <Board
                  kicker="DEPARTURES · THE RULE"
                  label="The five outcomes of a Span"
                  cols={COLS}
                  rows={rows}
                  rowGap={0}
                  maxFlips={MAX_FLIPS}
                  stagger={STAGGER}
                />
              </div>
              <p className={`rule__foot${visible > ROWS ? ' on' : ''}`}>
                The same rule has been law for two centuries: France 1804 (Code civil 1590), Italy 1942 (Codice civile 1385), T&uuml;rkiye 2011
                (TBK 178). Span makes it run on its own.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
