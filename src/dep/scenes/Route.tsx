import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Flap, type Tone } from '../Flap'
import { Count } from '../Count'
import { UsdcMark } from '../SpanLogo'
import { SceneHead } from '../SceneHead'
import { ramp, scrubProgress, setChart, useFlow } from '../scroll'
import { CHART_H, CHART_W, ROUTE_D, routeAt } from './routeMath'

/** `at` places the dot on the route; `show` is how far along the route the plane is when the card appears. */
type Waypoint = { at: number; show: number; text: string; k: string; status: string; tone: Tone; count?: number }

const WAYPOINTS: Waypoint[] = [
  { at: 0.02, show: 0.02, text: 'Rui locks a bond the size of the deposit.', k: 'BOND 450', status: 'LOCKED', tone: 'amber' },
  { at: 0.36, show: 0.3, text: 'Ana pays the deposit into the contract.', k: 'DEPOSIT 450', status: 'HELD', tone: 'amber' },
  { at: 0.68, show: 0.58, text: 'They meet at the viewing. Ana confirms.', k: 'HANDOVER', status: 'CONFIRMED', tone: 'green' },
  { at: 0.98, show: 0.84, text: 'Rui is paid 900: the deposit and his bond back.', k: '', status: 'PAID OUT', tone: 'ivory', count: 900 },
]
/** Pacing: the route is drawn over 3-75% of the pin, and everything is complete and held from 75% to 100%. */
const DRAW_FROM = 0.03
const DRAW_TO = 0.75

/** Waypoint positions are fixed by the route, so compute them once. */
const POINTS = WAYPOINTS.map((w) => routeAt(w.at))
const END = routeAt(1)

type Slot = (el: HTMLSpanElement | null) => void

/** A counter: written straight from the eased scroll progress (slot), or a timed count-up in normal flow. */
const Num = memo(function Num({ to, active, slot }: { to: number; active: boolean; slot?: Slot }) {
  return slot ? (
    <span ref={slot} className="count">
      0
    </span>
  ) : (
    <Count to={to} active={active} />
  )
})

const Chip = memo(function Chip({ w, on, slot }: { w: Waypoint; on: boolean; slot?: Slot }) {
  return (
    <span className="chip">
      {w.k && <span className="chip__k">{w.k} &middot;</span>}
      <Flap text={on ? w.status : ''} width={w.status.length} tone={w.tone} label={w.status} />
      {w.count !== undefined && (
        <span className="chip__k">
          &middot; <Num to={w.count} active={on} slot={slot} />
        </span>
      )}
    </span>
  )
})

const Pass = memo(function Pass({ step, bond, deposit }: { step: number; bond?: Slot; deposit?: Slot }) {
  return (
    <div className="pass" role="group" aria-label="Boarding pass for Span 41">
      <p className="pass__mid">SPAN #41 &middot; ARC &middot; GATE 5042</p>
      <div className="pass__row">
        <div className="pass__stub">
          <p className="pass__k">HOST</p>
          <p className="pass__name">Rui</p>
          <p className="pass__amt">
            BOND <UsdcMark size={14} /> <Num to={450} active={step >= 1} slot={bond} />
          </p>
        </div>
        <div className="pass__tear" aria-hidden="true" />
        <div className="pass__stub">
          <p className="pass__k">GUEST</p>
          <p className="pass__name">Ana</p>
          <p className="pass__amt">
            DEPOSIT <UsdcMark size={14} /> <Num to={450} active={step >= 2} slot={deposit} />
          </p>
        </div>
      </div>
    </div>
  )
})

export function Route() {
  const flow = useFlow()
  const root = useRef<HTMLElement>(null)
  const pin = useRef<HTMLDivElement>(null)
  const mask = useRef<SVGPathElement>(null)
  const plane = useRef<SVGGElement>(null)
  const counters = useRef<(HTMLSpanElement | null)[]>([null, null, null])
  const [step, setStep] = useState(0)
  const slots = useMemo<Slot[]>(
    () =>
      [0, 1, 2].map((i) => (el) => {
        counters.current[i] = el
      }),
    [],
  )

  useLayoutEffect(() => {
    const el = pin.current
    const maskPath = mask.current
    const planeEl = plane.current
    if (!el || !maskPath || !planeEl || flow) return
    const lastCount = [-1, -1, -1]
    let lastStep = 0
    // One update per eased frame: plane, dash offset and counters are all written here; React only hears
    // about a change of step.
    const apply = (p: number) => {
      const f = ramp(p, DRAW_FROM, DRAW_TO)
      const { x, y, angle } = routeAt(f)
      planeEl.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)})`)
      maskPath.style.strokeDashoffset = String(1 - f)
      const values = [Math.round(450 * ramp(f, 0.02, 0.2)), Math.round(450 * ramp(f, 0.3, 0.48)), Math.round(900 * ramp(f, 0.84, 0.99))]
      values.forEach((v, i) => {
        if (v === lastCount[i]) return
        lastCount[i] = v
        const node = counters.current[i]
        if (node) node.textContent = String(v)
      })
      const s = WAYPOINTS.filter((w) => f >= w.show).length
      if (s !== lastStep) {
        lastStep = s
        setStep(s)
      }
    }
    const stopPin = scrubProgress(
      el,
      {
        start: 'top top',
        end: '+=300%',
        pin: true,
        debug: { name: 'route', lastAt: DRAW_TO, content: el },
        // the chart is already up (it faded in during the old-way pin); it goes back when the pin releases
        extra: { onEnter: () => setChart(true), onEnterBack: () => setChart(true), onLeave: () => setChart(false) },
      },
      apply,
    )
    return () => {
      stopPin()
      maskPath.style.strokeDashoffset = ''
      setChart(false, 0)
    }
  }, [flow])

  // Flow: draw everything and flip the chips once the scene is in view.
  useEffect(() => {
    const el = root.current
    if (!flow || !el) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        WAYPOINTS.forEach((_, i) => timers.push(setTimeout(() => setStep(i + 1), 500 + i * 900)))
      },
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      timers.forEach(clearTimeout)
    }
  }, [flow])

  const slot = (i: number) => (flow ? undefined : slots[i])

  return (
    <section ref={root} className={`scene route${flow ? ' is-flow' : ''}`} id="how">
      <div ref={pin} className="scene__pin route__pin">
        <div className="scene__in">
          <div className="route__map">
            <div className="chart-stage route__stage">
              {flow && <img src="/dep/chart.webp" alt="" decoding="async" />}
              <svg className="route__svg" viewBox={`0 0 ${CHART_W} ${CHART_H}`} aria-hidden="true">
                <defs>
                  <radialGradient id="planeGlow">
                    <stop offset="0" stopColor="#FFB547" stopOpacity="0.6" />
                    <stop offset="1" stopColor="#FFB547" stopOpacity="0" />
                  </radialGradient>
                  <mask id="routeMask" maskUnits="userSpaceOnUse" x="0" y="0" width={CHART_W} height={CHART_H}>
                    <path
                      ref={mask}
                      d={ROUTE_D}
                      pathLength={1}
                      fill="none"
                      stroke="#fff"
                      strokeWidth="26"
                      strokeDasharray="1"
                      strokeDashoffset={flow ? 0 : 1}
                    />
                  </mask>
                </defs>
                <path d={ROUTE_D} fill="none" stroke="rgba(242,234,219,.18)" strokeWidth="4" strokeDasharray="14 18" />
                <path d={ROUTE_D} fill="none" stroke="#FFB547" strokeWidth="8" strokeLinecap="round" strokeDasharray="26 20" mask="url(#routeMask)" />
                {WAYPOINTS.map((w, i) => (
                  <g key={w.status} transform={`translate(${POINTS[i].x.toFixed(1)} ${POINTS[i].y.toFixed(1)})`}>
                    <g className={`route__dot${step > i ? ' on' : ''}`}>
                      <circle r="30" className="route__ring" />
                      <circle r="13" className="route__core" />
                    </g>
                  </g>
                ))}
                <g ref={plane} transform={`translate(${END.x.toFixed(1)} ${END.y.toFixed(1)}) rotate(${END.angle.toFixed(1)})`} className="route__plane">
                  <circle r="70" fill="url(#planeGlow)" />
                  <path d="M-44 0 L-18 -9 L-8 -38 L6 -38 L0 -8 L28 -15 L40 -15 L46 0 L40 15 L28 15 L0 8 L6 38 L-8 38 L-18 9 Z" />
                </g>
              </svg>
              {/* cards sit 56px from their dot, alternating sides, above the route and the plane */}
              {!flow &&
                WAYPOINTS.map((w, i) => (
                  <div
                    key={w.status}
                    className={`wp ${i % 2 === 0 ? 'wp--r' : 'wp--l'}${step > i ? ' on' : ''}`}
                    style={{ left: `${(POINTS[i].x / CHART_W) * 100}%`, top: `${(POINTS[i].y / CHART_H) * 100}%` }}
                  >
                    <p className="wp__text">{w.text}</p>
                    <Chip w={w} on={step > i} slot={slots[2]} />
                  </div>
                ))}
            </div>
          </div>
          <div className="route__ui">
            <div className="wrap">
              <SceneHead kicker="THE ROUTE" title="So the deposit flies with a flight plan." />
            </div>
          </div>
          <div className="route__pass">
            <div className="wrap">
              <Pass step={step} bond={slot(0)} deposit={slot(1)} />
            </div>
          </div>
          {flow && (
            <ol className="route__list">
              {WAYPOINTS.map((w, i) => (
                <li key={w.status} className={`wp wp--list${step > i ? ' on' : ''}`}>
                  <p className="wp__text">{w.text}</p>
                  <Chip w={w} on={step > i} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  )
}
