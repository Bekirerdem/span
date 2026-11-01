/** Porto to Lisbon in chart pixels (the chart is 2400 x 1339). Pure maths so nothing is measured from the DOM. */
type Pt = [number, number]
const SEGMENTS: [Pt, Pt, Pt, Pt][] = [
  [[1104, 281], [1170, 400], [1150, 520], [1110, 600]],
  [[1110, 600], [1070, 680], [1040, 760], [1022, 872]],
]

export const ROUTE_D = 'M1104 281 C1170 400 1150 520 1110 600 C1070 680 1040 760 1022 872'
export const CHART_W = 2400
export const CHART_H = 1339

function cubic([p0, p1, p2, p3]: [Pt, Pt, Pt, Pt], t: number): Pt {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]
}

type Sample = { x: number; y: number; len: number }
const SAMPLES: Sample[] = []
{
  let len = 0
  let prev: Pt | null = null
  for (const seg of SEGMENTS) {
    for (let i = 0; i <= 160; i++) {
      const [x, y] = cubic(seg, i / 160)
      if (prev) len += Math.hypot(x - prev[0], y - prev[1])
      prev = [x, y]
      SAMPLES.push({ x, y, len })
    }
  }
}
const TOTAL = SAMPLES[SAMPLES.length - 1].len

/** Position and heading (degrees) at a fraction of the way along the route. */
export function routeAt(fraction: number): { x: number; y: number; angle: number } {
  const target = Math.min(1, Math.max(0, fraction)) * TOTAL
  let lo = 0
  let hi = SAMPLES.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (SAMPLES[mid].len < target) lo = mid
    else hi = mid
  }
  const a = SAMPLES[lo]
  const b = SAMPLES[hi]
  const k = b.len === a.len ? 0 : (target - a.len) / (b.len - a.len)
  const i0 = Math.max(0, lo - 2)
  const i1 = Math.min(SAMPLES.length - 1, hi + 2)
  const angle = (Math.atan2(SAMPLES[i1].y - SAMPLES[i0].y, SAMPLES[i1].x - SAMPLES[i0].x) * 180) / Math.PI
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, angle }
}
