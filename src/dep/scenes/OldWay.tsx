import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Board, type BoardRow, type Col } from '../Board'
import { SceneHead } from '../SceneHead'
import { ScrollTrigger, gsap, ramp, scrubProgress, setChart, useFlow } from '../scroll'

const COLS: Col[] = [
  { key: 'time', label: 'Time', w: 5 },
  { key: 'route', label: 'Route', w: 14 },
  { key: 'dep', label: 'Deposit', w: 8, align: 'right' },
  { key: 'status', label: 'Status', w: 9, status: true },
]
const STATUSES = ['ON TIME', 'DELAYED', 'CANCELLED', 'GONE'] as const

const LINES = [
  'You found a room in Lisbon. You\u2019re in Porto.',
  'The host wants 450 today to hold it. Three others are asking.',
  'You wire it. The listing disappears. The number stops answering.',
]

/**
 * Pacing inside the pin. The story is finished by 75% and held for the last 25%:
 * lines at 0 / 8-17 / 26-35%, statuses flip at 20 / 36 / 52% (GONE, light out), stub 63-75%.
 * The terminal hands over to the chart over the last 15% (single source: setChart).
 */
const HAND_OVER = 0.85

export function OldWay() {
  const flow = useFlow()
  const root = useRef<HTMLElement>(null)
  const pin = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState(0)
  const [shown, setShown] = useState(false)

  // Pinned: eased scroll progress drives the lines, the stub, the status flips and the hand-over.
  useLayoutEffect(() => {
    const scope = root.current
    const el = pin.current
    if (!scope || !el || flow) return
    const lines = gsap.utils.toArray<HTMLElement>('.old__line', scope)
    const stub = scope.querySelector<HTMLElement>('.stub')
    if (stub) gsap.set(stub, { autoAlpha: 0, xPercent: 60, rotate: 7 })

    // React hears about a change only when the derived step really changes.
    const last = { idx: 0, chart: false }
    const apply = (p: number) => {
      // The first line is on screen the moment the pin starts; each new line dims the previous ones to 35%.
      const shownLine = [1, ramp(p, 0.08, 0.17), ramp(p, 0.26, 0.35)]
      lines.forEach((line, i) => {
        const dim = i < lines.length - 1 ? shownLine[i + 1] : 0
        gsap.set(line, { autoAlpha: shownLine[i] * (1 - 0.65 * dim), y: (1 - shownLine[i]) * 34 })
      })
      if (stub) {
        const t = ramp(p, 0.63, 0.75)
        gsap.set(stub, { autoAlpha: t, xPercent: (1 - t) * 60, rotate: (1 - t) * 7 })
      }
      const i = p < 0.2 ? 0 : p < 0.36 ? 1 : p < 0.52 ? 2 : 3
      if (i !== last.idx) {
        last.idx = i
        setIdx(i)
      }
      const chart = p >= HAND_OVER
      if (chart !== last.chart) {
        last.chart = chart
        setChart(chart)
      }
    }
    const stopPin = scrubProgress(el, { start: 'top top', end: '+=200%', pin: true, debug: { name: 'old way', lastAt: 0.75, content: el } }, apply)
    // The board starts flipping once, as the scene comes into view, so it is already live when the pin starts.
    const reveal = () => setShown(true)
    const enter = ScrollTrigger.create({ trigger: scope, start: 'top 85%', once: true, onEnter: reveal, onRefresh: (self) => self.progress > 0 && reveal() })
    return () => {
      stopPin()
      enter.kill()
      if (last.chart) setChart(false, 0)
      gsap.set([...lines, ...(stub ? [stub] : [])], { clearProps: 'all' })
    }
  }, [flow])

  // Flow: everything is on the page; the statuses flip once the board is in view.
  useEffect(() => {
    const el = root.current
    if (!flow || !el) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        setShown(true)
        ;[1, 2, 3].forEach((n) => timers.push(setTimeout(() => setIdx(n), 1100 * n)))
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      timers.forEach(clearTimeout)
    }
  }, [flow])

  const status = STATUSES[idx]
  const rows: BoardRow[] = [
    {
      id: 'wire',
      cells: shown ? ['18:00', 'WIRE > UNKNOWN', '450', status] : ['', '', '', ''],
      light: idx === 3 ? 'off' : idx === 2 ? 'red' : 'on',
    },
  ]

  return (
    <section ref={root} className={`scene old${flow ? ' is-flow' : ''}`} id="old">
      <div ref={pin} className="scene__pin">
        <div className="scene__in">
          <div className="wrap">
            <div className="grid12 old__grid">
              <div className="old__left">
                <SceneHead kicker="THE OLD WAY" />
                <Board kicker="DEPARTURES" label="Departures: a wire transfer to a stranger" cols={COLS} rows={rows} rowGap={0} />
                <aside className="stub" aria-label="Statistic">
                  <p className="stub__big">46%</p>
                  <p className="stub__body">of people who lost money to rental scams were 18 to 29.</p>
                  <p className="stub__src">&mdash; US Federal Trade Commission, 2025</p>
                </aside>
              </div>
              <ol className="old__lines">
                {LINES.map((line, i) => (
                  <li key={line} className="old__line">
                    <span className="old__n">0{i + 1}</span>
                    <p className="display old__text">{line}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
