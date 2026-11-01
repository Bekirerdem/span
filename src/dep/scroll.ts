import { useSyncExternalStore } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

export { gsap, ScrollTrigger }

/** Up to tablet width (1024px), or with reduced motion, scenes are normal flow instead of pinned. */
const FLOW_QUERY = '(max-width: 1024px), (prefers-reduced-motion: reduce)'

function subscribe(cb: () => void) {
  const mq = window.matchMedia(FLOW_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

export function useFlow() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(FLOW_QUERY).matches,
    () => false,
  )
}

let lenis: Lenis | null = null
let tickFn: ((t: number) => void) | null = null

function stopLenis() {
  if (tickFn) gsap.ticker.remove(tickFn)
  tickFn = null
  lenis?.destroy()
  lenis = null
}

/** Smooth scrolling wired into ScrollTrigger. Only one instance ever exists. Returns a cleanup. */
export function startScroll(): () => void {
  stopLenis() // React StrictMode mounts twice: never keep two instances
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  const instance = new Lenis({ lerp: 0.1 })
  lenis = instance
  instance.on('scroll', () => ScrollTrigger.update())
  tickFn = (t: number) => instance.raf(t * 1000)
  gsap.ticker.add(tickFn)
  gsap.ticker.lagSmoothing(0)
  return () => {
    if (lenis === instance) stopLenis()
  }
}

export function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  if (lenis) lenis.scrollTo(el, { duration: 1.6 })
  else el.scrollIntoView({ behavior: 'smooth' })
}

const BACKGROUND_IMAGES = ['/dep/terminal.webp', '/dep/chart.webp']

/** Pin positions depend on font metrics and image layout: refresh once both have loaded. */
export function refreshWhenAssetsReady() {
  const images = BACKGROUND_IMAGES.map(
    (src) =>
      new Promise<void>((resolve) => {
        const img = new Image()
        img.onload = () => resolve()
        img.onerror = () => resolve()
        img.src = src
      }),
  )
  void Promise.all([document.fonts.ready, ...images]).then(() => ScrollTrigger.refresh())
}

let chartOn = false

/**
 * The single source of truth for the terminal/chart crossfade. Tweens the two layers' opacity directly (no
 * document-wide style recalculation). Calling it with the current state is a no-op.
 */
export function setChart(on: boolean, duration = 0.9) {
  if (on === chartOn && duration > 0) return
  chartOn = on
  const ease = 'power2.inOut'
  gsap.to('.bg__termgroup', { opacity: on ? 0 : 1, duration, ease, overwrite: 'auto' })
  gsap.to('.bg__chart', { opacity: on ? 1 : 0, duration, ease, overwrite: 'auto' })
}

export const ramp = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)))

type PinDebug = { name: string; lastAt: number; content: Element }
type ScrubOptions = { start: string; end: string; pin?: boolean; extra?: ScrollTrigger.Vars; debug?: PinDebug }

const pinned = new Map<ScrollTrigger, PinDebug>()
let reportTimer: ReturnType<typeof setTimeout> | undefined

/** Dev only: one table of every pinned scene, so empty frames and unfinished animations are visible. */
function reportPins() {
  clearTimeout(reportTimer)
  reportTimer = setTimeout(() => {
    const rows = [...pinned.entries()]
      .map(([st, d]) => ({ st, d }))
      .sort((a, b) => a.st.start - b.st.start)
      .map(({ st, d }, i, all) => {
        const length = st.end - st.start
        const next = all[i + 1]
        return {
          scene: d.name,
          pinStart: Math.round(st.start),
          pinEnd: Math.round(st.end),
          pinLength: Math.round(length),
          lastElementDoneAt: `${Math.round(d.lastAt * 100)}%`,
          heldForPx: Math.round(length * (1 - d.lastAt)),
          contentOpacity: getComputedStyle(d.content).opacity,
          pxToNextPinStart: next ? Math.round(next.st.start - st.end) : null,
        }
      })
    console.debug('[pins] viewport', window.innerHeight, 'px. Expect contentOpacity 1, heldForPx > 0, pxToNextPinStart about one viewport (the scene scrolls away normally).')
    console.debug('[pins]', JSON.stringify(rows))
  }, 300)
}
if (import.meta.env.DEV) ScrollTrigger.addEventListener('refresh', reportPins)

/**
 * Scroll-linked progress that eases (scrub 0.6) instead of jumping. `apply` receives 0..1 once per frame and
 * should only call setState when a derived step actually changes.
 */
export function scrubProgress(trigger: Element, { start, end, pin = false, extra, debug }: ScrubOptions, apply: (p: number) => void) {
  const proxy = { p: 0 }
  apply(0)
  const tween = gsap.to(proxy, {
    p: 1,
    ease: 'none',
    onUpdate: () => apply(proxy.p),
    scrollTrigger: {
      trigger,
      start,
      end,
      pin,
      scrub: 0.6,
      ...(pin ? { anticipatePin: 1 } : {}),
      fastScrollEnd: true,
      invalidateOnRefresh: true,
      ...extra,
    },
  })
  const st = tween.scrollTrigger
  if (import.meta.env.DEV && st && debug) pinned.set(st, debug)
  return () => {
    if (st) pinned.delete(st)
    st?.kill()
    tween.kill()
  }
}

/** A one-shot entrance for content that is not pinned: it rises in once when it comes into view. */
export function riseOnEnter(trigger: Element, target: HTMLElement) {
  target.classList.add('will-rise')
  const reveal = () => target.classList.add('is-in')
  const st = ScrollTrigger.create({
    trigger,
    start: 'top 88%',
    onEnter: reveal,
    onEnterBack: reveal,
    onRefresh: (self) => {
      if (self.progress > 0) reveal()
    },
  })
  return () => {
    st.kill()
    target.classList.remove('will-rise', 'is-in')
  }
}
