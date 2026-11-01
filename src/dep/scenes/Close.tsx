import { useLayoutEffect, useRef } from 'react'
import { navigate } from '../../router'
import { SceneHead } from '../SceneHead'
import { riseOnEnter, useFlow } from '../scroll'
import { NETWORK, SPAN_ADDRESS, addressUrl, short } from '../../span/chain'

const GITHUB_URL = import.meta.env.VITE_GITHUB_URL as string | undefined

/** A barcode drawn from hard-stop gradients; the pattern is fixed so it never shifts between renders. */
function barcode() {
  const widths = [2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 3, 2, 1, 1, 4, 2, 1, 3, 1, 2, 2, 1, 1, 3, 4, 1, 2, 1, 1, 2, 3, 1, 2, 4, 1, 1, 2, 3, 1, 2]
  const stops: string[] = []
  let x = 0
  widths.forEach((w, i) => {
    const color = i % 2 === 0 ? '#08132A' : 'transparent'
    stops.push(`${color} ${x}px ${x + w * 2}px`)
    x += w * 2
  })
  return `linear-gradient(90deg, ${stops.join(',')})`
}
const BARCODE = barcode()

export function Close() {
  const flow = useFlow()
  const section = useRef<HTMLElement>(null)
  const pass = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const scope = section.current
    const wrap = pass.current
    if (!scope || !wrap || flow) return
    return riseOnEnter(scope, wrap)
  }, [flow])

  return (
    <>
      <section ref={section} className="scene close" id="close">
        <div className="wrap">
        <div ref={pass} className="close__pass" role="group" aria-label="Boarding pass">
          <div className="close__main">
            <SceneHead
              kicker="SPAN · ARC · GATE 5042"
              title="Trust the rule, not the stranger."
              lead="Open a Span, lock your bond, send the link. The deposit waits between you until the handover."
            />
            <a className="btn-primary" href="/new" onClick={(e) => (e.preventDefault(), navigate('/new'))}>
              Open a Span
            </a>
          </div>
          <div className="close__tear" aria-hidden="true" />
          <div className="close__stub" aria-hidden="true">
            <span className="close__bars" style={{ backgroundImage: BARCODE }} />
            <span className="close__code">{short(SPAN_ADDRESS)}</span>
          </div>
        </div>
        </div>
      </section>
      <footer className="foot">
        <div className="wrap foot__in">
        <span>Built in Arc Studio</span>
        <span>{NETWORK === 'mainnet' ? 'Arc mainnet' : 'Arc testnet'}</span>
        {GITHUB_URL && (
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        )}
        <a href={addressUrl(SPAN_ADDRESS)} target="_blank" rel="noopener noreferrer">
          Contract
        </a>
        </div>
      </footer>
    </>
  )
}
