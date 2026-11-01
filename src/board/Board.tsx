import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { initLanding } from './engine'
import { navigate } from '../router'
import { SPAN_ADDRESS, addressUrl } from '../span/chain'
import { SpanLogo } from './SpanLogo'
import './board.css'

const REPO_URL = 'https://github.com/Bekirerdem/span'

type CardStyle = CSSProperties & { '--r': string }
/** Position + resting tilt for a pinned card. */
const at = (left: string | null, top: string | null, r: string, extra: CSSProperties = {}): CardStyle => ({
  ...(left ? { left } : {}),
  ...(top ? { top } : {}),
  '--r': r,
  ...extra,
})

function ListingHalf({ side }: { side: 'l' | 'r' }) {
  return (
    <div className={`half ${side}`} aria-hidden={side === 'r' ? true : undefined}>
      <div className="tear">
        <div className="bar">
          <span>Room · Arroios, Lisbon</span>
          <span>posted 2h ago</span>
        </div>
        <table>
          <tbody>
            <tr>
              <td>Bright room, metro 2 min</td>
              <td>450 / month</td>
              <td className="q">3 others asking</td>
            </tr>
            <tr>
              <td>Deposit to hold it</td>
              <td>450</td>
              <td className="q">today only</td>
            </tr>
            <tr>
              <td>Viewing</td>
              <td>after payment</td>
              <td className="q">no calls</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Vote({ who, label }: { who: string; label: string }) {
  return (
    <div className="vote">
      {who}
      <i className="splat" />
      <i className="stamp">{label}</i>
    </div>
  )
}

function Open({ children, className = 'btn' }: { children: ReactNode; className?: string }) {
  return (
    <a
      className={className}
      href="/new"
      onClick={(e) => {
        e.preventDefault()
        navigate('/new')
      }}
    >
      {children}
    </a>
  )
}

export default function Board() {
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    document.documentElement.lang = 'en'
    document.body.classList.add('landing-body')
    const dispose = initLanding(el)
    return () => {
      dispose()
      document.body.classList.remove('landing-body')
    }
  }, [])

  return (
    <div className="landing" ref={root}>
      <div className="cursor" aria-hidden="true">
        <i className="c-needle" />
        <i className="c-head" />
      </div>

      <div className="strip">
        <div className="brand">
          <div className="tape" />
          <SpanLogo size={24} />
          <b>Span</b>
          <span>holding deposits on Arc</span>
        </div>
        <nav className="navcard" aria-label="Main">
          <a href="#but">Why</a>
          <a href="#so">How</a>
          <a href="#rules">Rules</a>
          <Open className="cta">Open a Span</Open>
        </nav>
      </div>

      {/* 1 · HERO — two strangers, one deposit, one rule between them */}
      <section className="scene" id="hero" data-scene="hero">
        <div className="stage" id="heroStage">
          <canvas className="threads" />
          <div className="hero-copy">
            <span className="eyebrow">Holding deposits between strangers</span>
            <h1>
              <span className="line">
                <span>Pay the deposit</span>
              </span>
              <span className="line">
                <span>to the rule,</span>
              </span>
              <span className="line">
                <span>
                  <em>not the stranger.</em>
                </span>
              </span>
            </h1>
            <p className="lede">
              The host locks a bond. You lock the deposit. It waits on Arc until the handover, and whoever walks away
              pays, exactly as the law says.
            </p>
            <div className="btnrow">
              <Open>
                Open a Span <span className="arr">→</span>
              </Open>
              <a className="btn ghost" href="#but">
                See what goes wrong today <span className="arr">↓</span>
              </a>
            </div>
          </div>

          <div className="card client kraft hc lift" id="cList" data-depth="1.2" style={at('60vw', '9vh', '-2.5deg')}>
            <i className="pin" />
            <span className="label">Listing · Lisbon</span>
            <div className="cname">Room in Arroios</div>
            <span className="paylink">450 USDC to hold ↗</span>
          </div>
          <div className="card client kraft hc lift" id="cWire" data-depth=".85" style={at('82vw', '12vh', '3deg')}>
            <i className="pin" />
            <span className="label">The old way</span>
            <div className="cname">Wire to a stranger</div>
            <span className="paylink no">no way back ✕</span>
          </div>
          <div className="card job hc lift" id="jSpan" data-depth=".95" style={at('64vw', '37vh', '1.5deg')}>
            <i className="pin brass" />
            <span className="label">Span #41 · held on Arc</span>
            <h4>Holding deposit</h4>
            <div className="jobamt">450 deposit + 450 bond</div>
            <div className="who">
              <span className="chip">Ana paid ✓</span>
              <span className="chip">Rui bonded ✓</span>
            </div>
          </div>
          <div
            className="card member hc lift"
            id="mGuest"
            data-depth="1.15"
            data-bead="450 USDC"
            style={at('57vw', '67vh', '-4deg')}
          >
            <i className="pin" />
            <div className="face">A</div>
            <div className="name">Ana</div>
            <div className="role">guest · moving from Porto</div>
          </div>
          <div className="card member hc lift" id="mHost" data-depth=".8" style={at('80vw', '64vh', '3deg')}>
            <i className="pin" />
            <div className="face" style={{ background: '#2f4a3a' }}>
              R
            </div>
            <div className="name">Rui</div>
            <div className="role">host · Arroios</div>
          </div>
        </div>
      </section>

      {/* 2 · BUT — the deposit goes to a stranger, the listing vanishes */}
      <section className="scene" id="but" data-scene="but">
        <div className="stage" id="butStage">
          <canvas className="threads" />
          <div className="card sticky bc lift" id="stA" style={at('8vw', '14vh', '-6deg')}>
            <i className="pin" />
            <p className="note">Send the 450 today. Three others want the room.</p>
            <span className="sig">— the “host”</span>
          </div>
          <div className="card sticky pink bc lift" id="stB" style={at('66vw', '9vh', '5deg')}>
            <i className="pin" />
            <p className="note">Sent. See you Saturday!</p>
            <span className="sig">— Ana</span>
          </div>
          <div className="card sticky blue bc lift" id="stC" style={at('72vw', '43vh', '-3deg')}>
            <i className="pin" />
            <p className="note">This number is no longer in service.</p>
          </div>
          <div className="card sheet" id="sheet" style={at('30vw', '20vh', '-1.5deg')}>
            <i className="pin" id="sheetPin" />
            <ListingHalf side="l" />
            <ListingHalf side="r" />
          </div>
          <div data-split className="big-say but-title">
            The deposit goes to <i>a stranger.</i> Then the listing is gone.
          </div>
          <p data-split className="but-cite">
            46% of people who lost money to rental scams were 18 to 29. US Federal Trade Commission, 2025.
          </p>
        </div>
      </section>

      {/* 3 · SO — the deposit waits between them */}
      <section className="scene" id="so" data-scene="so">
        <div className="stage" id="soStage">
          <canvas className="threads" />
          <div data-split className="big-say so-title">
            So the deposit waits between you.
          </div>
          <div className="card invoice lift" id="inv" data-bead="deposit 450" style={at('7vw', '12vh', '-2deg')}>
            <i className="pin" />
            <span className="label">Ana pays the link</span>
            <div className="row">
              <span className="note" style={{ fontSize: 19 }}>
                Deposit to hold the room
              </span>
              <span className="amount">450 USDC</span>
            </div>
          </div>
          <div className="card job lift" id="soJob" style={at('12vw', '42vh', '1.5deg')}>
            <i className="pin brass" />
            <span className="label">Span #41 · contract on Arc</span>
            <h4>Room in Arroios</h4>
            <div className="who">
              <span className="chip">bond 450 ✓</span>
              <span className="chip">deposit 450 ✓</span>
            </div>
          </div>
          <div className="card reserve lift" id="res" data-bead="bond 450" style={at('38vw', '12vh', '-1deg')}>
            <i className="pin" />
            <span className="label" style={{ position: 'relative' }}>
              Rui locks a bond first
            </span>
            <span className="amount" style={{ position: 'relative' }}>
              <span className="odo" id="resAmt" data-max="450" /> USDC
            </span>
          </div>
          <div className="card payee lift" id="pAli" data-bead="900 to Rui" style={at('40vw', '50vh', '-3deg')}>
            <i className="pin" />
            <span className="label">Rui · Ana confirmed</span>
            <div className="amount">
              <span className="odo" id="aliAmt" data-max="900" /> USDC
            </div>
            <span className="chip paycur">deposit + bond back</span>
          </div>
          <div className="card payee lift" id="pAyse" data-bead="or 900 to Ana" style={at('55vw', '55vh', '2.5deg')}>
            <i className="pin" />
            <span className="label">Ana · if Rui backs out</span>
            <div className="amount">
              <span className="odo" id="ayseAmt" data-max="900" /> USDC
            </div>
            <span className="chip paycur">double back</span>
          </div>
          <div className="burst" id="burst" />
          <div className="steps">
            <div className="step">
              <b>01</b>
              <span>Rui locks a bond the size of the deposit</span>
            </div>
            <div className="step">
              <b>02</b>
              <span>Ana pays the deposit into the contract</span>
            </div>
            <div className="step">
              <b>03</b>
              <span>They meet. Ana confirms</span>
            </div>
            <div className="step">
              <b>04</b>
              <span>Rui is paid. Nobody else could touch it</span>
            </div>
          </div>
          <div className="ptape" id="ptape" data-labels="Mon,Tue,Wed,Thu,Fri,Sat,Sun" data-now="86%">
            <span
              className="label"
              style={{ position: 'absolute', right: 18, top: -24, background: 'var(--paper)', padding: '3px 8px', transform: 'rotate(1deg)' }}
            >
              The week of the viewing
            </span>
            <div className="ticks" />
            <div className="days" />
            <span className="now" />
            <span className="flag" id="fl1" style={{ left: '3%' }}>
              Mon <b>bond</b> locked
            </span>
            <span className="flag" id="fl2" style={{ left: '22%' }}>
              Tue <b>deposit</b> paid
            </span>
            <span className="flag" id="fl3" style={{ left: '72%' }}>
              Sat <b>viewing</b> confirmed
            </span>
          </div>
        </div>
      </section>

      {/* 4 · RULES — whoever walks away pays; a dispute freezes the money */}
      <section className="scene" id="rules" data-scene="rules">
        <div className="stage" id="rulesStage">
          <canvas className="threads" />
          <div data-split className="big-say rules-title">
            Whoever walks away pays. The law has said so for two hundred years.
          </div>
          <div className="card ballot lift" id="ballot" style={at('7vw', '44vh', '-1.5deg')}>
            <i className="pin" />
            <span className="label">One rule, three civil codes</span>
            <span className="tally">
              <span className="odo" id="voteOdo" data-max="3" data-final="3" />
              /3
            </span>
            <h4>Back out and lose the deposit. Take it and back out, pay it twice.</h4>
            <div className="votes">
              <Vote who="FR" label="1804" />
              <Vote who="IT" label="1942" />
              <Vote who="TR" label="2011" />
            </div>
            <span className="label needs">Code civil 1590 · Codice civile 1385 · TBK 178</span>
          </div>
          <div className="card sender kraft lift" id="sender" style={at('84vw', '40vh', '4deg')}>
            <i className="pin" />
            <span className="label">Rui wants</span>
            <div className="amount">900 USDC</div>
          </div>
          <div className="card agent lift" id="agent" style={at('50vw', '15vh', '2deg')}>
            <i className="pin brass" />
            <span className="label">Ana disputes</span>
            <p className="note" style={{ marginTop: 8 }}>
              Something was wrong at the viewing. The money freezes, and nobody can take it alone.
            </p>
          </div>
          <span className="held" id="held">
            FROZEN
          </span>
          <div className="card ruler" id="ruler" style={at('44vw', '58vh', '-1deg')}>
            <i className="pin" />
            <span className="limitline" />
            <span className="needle" id="needle" />
            <span className="label">7 days to agree a split</span>
            <span className="limit">day 7 · both refunded</span>
          </div>
          <div className="card receipt" id="receipt" style={at('7vw', '76vh', '.6deg')}>
            <i className="pin brass" />
            <div className="ln" data-text="span #41 opened    bond 450 locked" />
            <div className="ln" data-text="deposit 450 paid   held by the contract" />
            <div className="ln" data-text="dispute raised     funds frozen" />
            <div className="ln" data-text="day 7, no split    both sides refunded" />
          </div>
        </div>
      </section>

      {/* 5 · CLOSE */}
      <section className="close" id="start">
        <div className="card close-card lift" id="closeCard" style={at(null, null, '-.8deg')}>
          <i className="pin" />
          <div className="card period" id="periodCard" style={at(null, null, '6deg')}>
            <i className="pin brass" />
            <span className="label">Span #42</span>
            <div className="amount" style={{ marginTop: 6 }}>
              opens now
            </div>
          </div>
          <span className="label">Live on Arc · paid in USDC</span>
          <h2 data-split style={{ marginTop: 18 }}>
            Trust the rule, not the stranger.
          </h2>
          <p>
            Open a Span, lock your bond and send the link. The deposit waits between you until the handover. The contract
            has no owner, no admin key and no fee.
          </p>
          <div className="btnrow">
            <Open>
              Open a Span <span className="arr">→</span>
            </Open>
            <a className="btn ghost" href={addressUrl(SPAN_ADDRESS)} target="_blank" rel="noopener noreferrer">
              See the contract <span className="arr">↗</span>
            </a>
          </div>
        </div>
      </section>
      <footer className="foot">
        <div className="foot-grid">
          <div className="foot-brand">
            <a href="/" className="foot-mark">
              <SpanLogo size={40} dark />
              <b>Span</b>
            </a>
            <p>A deposit that waits for both of you.</p>
            <span className="live">
              <i />
              Live on Arc
            </span>
          </div>
          <nav className="foot-col" aria-label="Product">
            <h4>Product</h4>
            <Open className="">
              Open a Span <span className="arr">→</span>
            </Open>
            <a href="#so">How it works</a>
            <a href="#rules">The rule</a>
          </nav>
          <nav className="foot-col" aria-label="Trust">
            <h4>Trust</h4>
            <a href={addressUrl(SPAN_ADDRESS)} target="_blank" rel="noopener noreferrer">
              Contract ↗
            </a>
            <a href={`${REPO_URL}#readme`} target="_blank" rel="noopener noreferrer">
              README ↗
            </a>
          </nav>
          <nav className="foot-col" aria-label="Built with">
            <h4>Built with</h4>
            <a href="https://studio.arc.io" target="_blank" rel="noopener noreferrer">
              Arc Studio ↗
            </a>
            <a href="https://www.arc.network" target="_blank" rel="noopener noreferrer">
              Arc ↗
            </a>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              GitHub ↗
            </a>
          </nav>
        </div>
        <div className="foot-bottom">
          <span>Span is software. It never holds your money; the contract on Arc does.</span>
          <span>span · Arc mainnet</span>
        </div>
      </footer>
    </div>
  )
}
