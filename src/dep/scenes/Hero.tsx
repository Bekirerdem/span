import { Board, type BoardRow, type Col } from '../Board'
import { navigate } from '../../router'
import { scrollToId } from '../scroll'

const COLS: Col[] = [
  { key: 'time', label: 'Time', w: 5 },
  { key: 'route', label: 'Route', w: 16 },
  { key: 'for', label: 'For', w: 14 },
  { key: 'dep', label: 'Deposit', w: 8, align: 'right' },
  { key: 'status', label: 'Status', w: 9, status: true },
]

const DATA: [string, string, string, string, string, 'on' | 'off'][] = [
  ['18:00', 'PORTO > LISBON', 'ROOM ARROIOS', '450 USDC', 'LOCKED', 'on'],
  ['09:30', 'BERLIN > PORTO', 'VAN, 3 DAYS', '300 USDC', 'CONFIRMED', 'on'],
  ['14:15', 'MILAN > NICE', 'VILLA DEPOSIT', '800 USDC', 'BOARDING', 'on'],
  ['21:40', 'MADRID > LISBON', 'STUDIO FLAT', '600 USDC', 'PAID OUT', 'off'],
]

const ROWS: BoardRow[] = DATA.map(([time, route, forWhat, dep, status, light], i) => ({
  id: String(i),
  cells: [time, route, forWhat, dep, status],
  light,
}))

export function Hero() {
  return (
    <section className="hero" id="top">
      <div className="wrap">
        <div className="grid12 hero__grid">
          <div className="hero__copy">
            <h1 className="display hero__title">Pay the deposit to the rule, not the stranger.</h1>
            <p className="hero__lede">
              Span holds a deposit between two people who haven&rsquo;t met. The host locks a bond, you lock the deposit, and whoever walks
              away pays. It waits on Arc until the handover.
            </p>
            <div className="hero__cta">
              <a className="btn-primary" href="/new" onClick={(e) => (e.preventDefault(), navigate('/new'))}>
                Open a Span
              </a>
              <button className="btn-ghost" onClick={() => scrollToId('how')}>
                See the route
              </button>
            </div>
          </div>
          <div className="hero__board">
            <Board kicker="DEPARTURES · HOLDING DEPOSITS" label="Departures: example deposits" cols={COLS} rows={ROWS} clock delay={900} rowGap={450} />
          </div>
        </div>
      </div>
    </section>
  )
}
