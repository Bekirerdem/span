import './flap.css'
import { memo, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

export type Tone = 'amber' | 'green' | 'red' | 'ivory' | 'soft'

/** The drum every flap cycles through, in order, like a real Solari board. */
export const CHARSET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.:>#'
const STEP_MS = 45
const STAGGER_MS = 25
/** No tile ever flips more than this many times for one change (a board may lower it). */
const MAX_FLIPS = 8

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const glyph = (c: string) => (c === ' ' ? '\u00a0' : c)
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Colour coding for status cells. */
export function toneFor(status: string): Tone {
  const s = status.toUpperCase()
  if (s === 'CANCELLED' || s === 'GONE' || s === 'DISPUTED') return 'red'
  if (s === 'CONFIRMED' || s === 'ON TIME' || s === 'OPEN') return 'green'
  if (s === 'PAID OUT' || s === 'CLOSED' || s === 'AUTO') return 'ivory'
  if (s === 'LOCKED' || s === 'BOARDING' || s === 'HOLD' || s === 'DELAYED' || s === 'HELD' || s === 'DOUBLE') return 'amber'
  return 'ivory'
}

/** The characters a flap shows on its way from one character to another (at most MAX_FLIPS of them). */
function route(from: string, to: string, maxFlips = MAX_FLIPS): string[] {
  const j = CHARSET.indexOf(to)
  if (j < 0) return [to]
  const n = CHARSET.length
  const i = CHARSET.indexOf(from)
  const out: string[] = []
  let k = i < 0 ? 0 : (i + 1) % n
  for (let guard = 0; guard <= n; guard++) {
    out.push(CHARSET[k])
    if (k === j) break
    k = (k + 1) % n
  }
  return out.length > maxFlips ? out.slice(-maxFlips) : out
}

/** How long a blank flap row takes to flip to `text`, so callers can start the next row afterwards. */
export function flipDuration(text: string, width?: number, maxFlips = MAX_FLIPS, stagger = STAGGER_MS): number {
  const upper = text.toUpperCase()
  const chars = Array.from(upper.padEnd(width ?? upper.length, ' ').slice(0, width ?? upper.length))
  let longest = 0
  chars.forEach((c, i) => {
    if (c === ' ') return
    longest = Math.max(longest, i * stagger + route(' ', c, maxFlips).length * STEP_MS)
  })
  return longest
}

/* ---- on-screen tracking: boards only flip while they are visible ---- */

const watchers = new Map<Element, (visible: boolean) => void>()
let observer: IntersectionObserver | null = null

function watch(el: Element, cb: (visible: boolean) => void) {
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) watchers.get(entry.target)?.(entry.isIntersecting)
  })
  watchers.set(el, cb)
  observer.observe(el)
  return () => {
    watchers.delete(el)
    observer?.unobserve(el)
  }
}

function inViewport(el: Element) {
  const r = el.getBoundingClientRect()
  return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth
}

/* ---- one tile ---- */

type Parts = {
  topStatic: HTMLElement
  botStatic: HTMLElement
  leafTop: HTMLElement
  leafBot: HTMLElement
  leafTopGlyph: HTMLElement
  leafBotGlyph: HTMLElement
}

function parts(root: HTMLElement): Parts {
  const get = (cls: string) => root.querySelector<HTMLElement>(cls) as HTMLElement
  return {
    topStatic: get('.fl-ts'),
    botStatic: get('.fl-bs'),
    leafTop: get('.fl-lt'),
    leafBot: get('.fl-lb'),
    leafTopGlyph: get('.fl-lt i'),
    leafBotGlyph: get('.fl-lb i'),
  }
}

function setAll(p: Parts, c: string) {
  const g = glyph(c)
  p.topStatic.textContent = g
  p.botStatic.textContent = g
  p.leafTopGlyph.textContent = g
  p.leafBotGlyph.textContent = g
}

/**
 * One real 3D flip: the top leaf falls, then the bottom leaf lands. The soft shadow is part of each leaf's
 * own animation (--sh), so a step costs two animations, and will-change exists only while it runs.
 */
async function flipOnce(p: Parts, from: string, to: string, alive: () => boolean): Promise<boolean> {
  p.topStatic.textContent = glyph(to)
  p.botStatic.textContent = glyph(from)
  p.leafTopGlyph.textContent = glyph(from)
  p.leafBotGlyph.textContent = glyph(to)
  const half = STEP_MS / 2
  p.leafTop.classList.add('is-flipping')
  p.leafBot.classList.add('is-flipping')
  const done = (ok: boolean, ...anims: Animation[]) => {
    anims.forEach((a) => a.cancel())
    p.leafTop.classList.remove('is-flipping')
    p.leafBot.classList.remove('is-flipping')
    return ok
  }
  const fall = p.leafTop.animate(
    [
      { transform: 'rotateX(0deg)', '--sh': 0 },
      { transform: 'rotateX(-90deg)', '--sh': 0.55 },
    ],
    { duration: half, easing: 'cubic-bezier(.5,0,1,1)', fill: 'forwards' },
  )
  await fall.finished
  if (!alive()) return done(false, fall)
  const land = p.leafBot.animate(
    [
      { transform: 'rotateX(90deg)', '--sh': 0.55 },
      { transform: 'rotateX(0deg)', '--sh': 0 },
    ],
    { duration: half, easing: 'cubic-bezier(0,0,.4,1)', fill: 'forwards' },
  )
  await land.finished
  if (!alive()) return done(false, fall, land)
  setAll(p, to)
  return done(true, fall, land)
}

const Tile = memo(function Tile({ char, delay, visible, maxFlips }: { char: string; delay: number; visible: RefObject<boolean>; maxFlips: number }) {
  const root = useRef<HTMLSpanElement>(null)
  const shown = useRef(' ')

  useEffect(() => {
    const el = root.current
    if (!el) return
    const p = parts(el)
    let cancelled = false
    const alive = () => !cancelled
    const finish = () => {
      setAll(p, char)
      shown.current = char
    }

    const run = async () => {
      if (delay > 0) await sleep(delay)
      if (!alive() || shown.current === char) return
      if (reducedMotion() || typeof el.animate !== 'function' || !visible.current) {
        finish()
        return
      }
      for (const next of route(shown.current, char, maxFlips)) {
        if (!alive()) return
        if (!visible.current) {
          finish() // left the viewport mid-flip: land instantly
          return
        }
        if (!(await flipOnce(p, shown.current, next, alive))) return
        shown.current = next
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [char, delay, visible, maxFlips])

  return (
    <span ref={root} className="fl-tile" aria-hidden="true">
      <span className="fl-half fl-top">
        <i className="fl-ts">{'\u00a0'}</i>
      </span>
      <span className="fl-half fl-bot">
        <i className="fl-bs">{'\u00a0'}</i>
      </span>
      <span className="fl-leaf fl-lt">
        <i>{'\u00a0'}</i>
      </span>
      <span className="fl-leaf fl-lb">
        <i>{'\u00a0'}</i>
      </span>
      <span className="fl-hinge" />
    </span>
  )
})

type FlapProps = {
  text: string
  /** Number of tiles. Defaults to the text length. */
  width?: number
  tone?: Tone
  /** Milliseconds before the first tile starts flipping. */
  delay?: number
  label?: string
  className?: string
  /** Most flips a tile makes per change. Default 8. */
  maxFlips?: number
  /** Milliseconds between one tile starting and the next. Default 25. */
  stagger?: number
}

/** A row of split-flap tiles that flips to `text` whenever it changes. Only tiles whose character changed move. */
export const Flap = memo(function Flap({ text, width, tone = 'ivory', delay = 0, label, className = '', maxFlips = MAX_FLIPS, stagger = STAGGER_MS }: FlapProps) {
  const root = useRef<HTMLSpanElement>(null)
  const visible = useRef(false)

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    visible.current = inViewport(el)
    return watch(el, (v) => {
      visible.current = v
    })
  }, [])

  const upper = text.toUpperCase()
  const w = width ?? upper.length
  const chars = Array.from(upper.padEnd(w, ' ').slice(0, w))
  return (
    <span ref={root} className={`flap flap--${tone} ${className}`} role="img" aria-label={label ?? text}>
      {chars.map((c, i) => (
        <Tile key={i} char={c} delay={delay + i * stagger} visible={visible} maxFlips={maxFlips} />
      ))}
    </span>
  )
})
