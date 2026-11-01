import { memo, useEffect, useRef } from 'react'
import { gsap } from './scroll'

/** A number that counts up from zero when `active` turns true. */
export const Count = memo(function Count({ to, active, duration = 1.1 }: { to: number; active: boolean; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!active) {
      el.textContent = '0'
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = String(to)
      return
    }
    const o = { v: 0 }
    const tween = gsap.to(o, {
      v: to,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = String(Math.round(o.v))
      },
    })
    return () => {
      tween.kill()
    }
  }, [to, active, duration])
  return (
    <span ref={ref} className="count">
      0
    </span>
  )
})
