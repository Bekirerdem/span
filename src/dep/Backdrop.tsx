import { memo, useEffect, useLayoutEffect, useRef } from 'react'
import './backdrop.css'
import { gsap, ScrollTrigger, refreshWhenAssetsReady } from './scroll'

const LIGHTS = 16
const FRAME_MS = 1000 / 30

/** One pre-rendered glow, drawn many times, instead of a gradient per light per frame. */
function makeSprite(): HTMLCanvasElement {
  const size = 64
  const sprite = document.createElement('canvas')
  sprite.width = size
  sprite.height = size
  const g = sprite.getContext('2d')
  if (g) {
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    grad.addColorStop(0, 'rgba(255,236,196,1)')
    grad.addColorStop(0.12, 'rgba(255,200,110,0.9)')
    grad.addColorStop(0.3, 'rgba(255,181,71,0.32)')
    grad.addColorStop(1, 'rgba(255,181,71,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, size, size)
  }
  return sprite
}

/**
 * Approach lights in perspective, pulsing towards the horizon. Capped at 30 fps, paused while the tab is
 * hidden, and only running while the hero and old-way scenes are on screen (it fades out after that).
 */
const Runway = memo(function Runway() {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const sprite = makeSprite()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0
    let h = 0
    let raf = 0
    let last = 0
    let running = false
    let wanted = true
    let visible = !document.hidden
    let cutoff = Infinity

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      w = el.clientWidth
      h = el.clientHeight
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = (time: number) => {
      ctx.clearRect(0, 0, w, h)
      const horizon = h * 0.08
      const cx = w * 0.5
      const span = w * 0.46
      for (let i = 0; i < LIGHTS; i++) {
        const depth = 1 + i * 0.6
        const y = horizon + (h - horizon) / depth
        const wave = 0.5 + 0.5 * Math.cos(Math.PI * 2 * (i / LIGHTS - time * 0.32))
        const glow = 0.25 + 0.75 * wave ** 3
        const size = Math.max(8, 70 / depth + 8)
        const xs = [cx - span / depth, cx + span / depth, cx]
        for (let k = 0; k < 3; k++) {
          ctx.globalAlpha = k === 2 ? glow * 0.55 : glow
          ctx.drawImage(sprite, xs[k] - size / 2, y - size / 2, size, size)
        }
      }
      ctx.globalAlpha = 1
    }

    const loop = (ms: number) => {
      raf = requestAnimationFrame(loop)
      if (ms - last < FRAME_MS) return
      last = ms
      draw(ms / 1000)
    }
    const sync = () => {
      const shouldRun = wanted && visible && !reduce
      el.classList.toggle('off', !wanted)
      if (shouldRun && !running) {
        running = true
        raf = requestAnimationFrame(loop)
      } else if (!shouldRun && running) {
        running = false
        cancelAnimationFrame(raf)
      }
    }

    // The runway belongs to the first two scenes: stop at the route scene.
    const measure = () => {
      const how = document.getElementById('how')
      cutoff = how ? how.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.5 : Infinity
    }
    const onScroll = () => {
      const next = window.scrollY < cutoff
      if (next !== wanted) {
        wanted = next
        sync()
      }
    }
    const onVisibility = () => {
      visible = !document.hidden
      sync()
    }

    resize()
    measure()
    onScroll()
    if (reduce) draw(0.4)
    sync()
    window.addEventListener('resize', resize)
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    ScrollTrigger.addEventListener('refresh', measure)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      ScrollTrigger.removeEventListener('refresh', measure)
    }
  }, [])

  return <canvas ref={canvas} className="bg__runway" />
})

/** The fixed night-terminal stage behind every screen. Nothing here animates a filter or a blend mode. */
export function Backdrop() {
  const group = useRef<HTMLDivElement>(null)
  const soft = useRef<HTMLDivElement>(null)
  const sheen = useRef<HTMLDivElement>(null)

  // Slow parallax (transform only). The "blur" is a second, statically blurred layer whose opacity ramps.
  useLayoutEffect(() => {
    const el = group.current
    const blurred = soft.current
    if (!el || !blurred || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const scrollTrigger = { trigger: document.body, start: 0, end: () => Math.min(2400, document.body.scrollHeight), scrub: true }
    const move = gsap.to(el, { yPercent: -6, ease: 'none', scrollTrigger })
    const fade = gsap.to(blurred, { opacity: 1, ease: 'none', scrollTrigger: { ...scrollTrigger } })
    return () => {
      move.scrollTrigger?.kill()
      fade.scrollTrigger?.kill()
      move.kill()
      fade.kill()
    }
  }, [])

  // The glass reflection follows the mouse by a few pixels.
  useEffect(() => {
    const el = sheen.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const x = gsap.quickTo(el, 'x', { duration: 0.9, ease: 'power3.out' })
    const y = gsap.quickTo(el, 'y', { duration: 0.9, ease: 'power3.out' })
    const move = (e: PointerEvent) => {
      x((e.clientX / window.innerWidth - 0.5) * 24)
      y((e.clientY / window.innerHeight - 0.5) * 24)
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [])

  useEffect(() => {
    refreshWhenAssetsReady()
  }, [])

  return (
    <div className="bg" aria-hidden="true">
      <div ref={group} className="bg__termgroup">
        <div className="bg__term" />
        <div ref={soft} className="bg__term bg__term--soft" />
      </div>
      <div className="bg__chart chart-stage">
        <img src="/dep/chart.webp" alt="" decoding="async" />
      </div>
      <div className="bg__shade" />
      <div className="bg__glow bg__glow--amber" />
      <div className="bg__glow bg__glow--blue" />
      <Runway />
      <div ref={sheen} className="bg__sheen" />
      <div className="bg__grain" />
    </div>
  )
}
