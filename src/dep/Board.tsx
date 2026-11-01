import { memo, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Flap, toneFor, type Tone } from './Flap'
import { navigate } from '../router'

export type Col = {
  key: string
  label: string
  /** Width in flap tiles. */
  w: number
  align?: 'right'
  /** Colour the cell by its status text. */
  status?: boolean
}

export type BoardRow = {
  id: string
  /** A string becomes a row of flaps; a node is rendered as is. */
  cells: ReactNode[]
  tones?: (Tone | undefined)[]
  /** Row light: on, red, or off. */
  light?: 'on' | 'red' | 'off'
  href?: string
}

type BoardProps = {
  kicker: string
  cols: Col[]
  rows: BoardRow[]
  clock?: boolean
  /** Milliseconds before the first row starts flipping. */
  delay?: number
  /** Extra milliseconds between rows. */
  rowGap?: number
  footer?: ReactNode
  className?: string
  label: string
  fs?: number
  /** Most flips a tile makes per change on this board. */
  maxFlips?: number
  /** Milliseconds between one tile and the next. */
  stagger?: number
}

const timeNow = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function Clock() {
  const [time, setTime] = useState(timeNow)
  useEffect(() => {
    const t = setInterval(() => setTime(timeNow()), 10_000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="dboard__clock" role="timer" aria-label={`Local time ${time}`}>
      LOCAL
      <Flap text={time} tone="amber" delay={300} />
    </span>
  )
}

type RowProps = { row: BoardRow; cols: Col[]; r: number; delay: number; rowGap: number; maxFlips?: number; stagger?: number }

const sameArray = <T,>(a: readonly T[] | undefined, b: readonly T[] | undefined) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]))

/** A row re-renders only when its own text, tones or light change. */
const Row = memo(
  function Row({ row, cols, r, delay, rowGap, maxFlips, stagger }: RowProps) {
    const inner = (
      <>
        <span className={`drow__led ${row.light ?? 'off'}`} aria-hidden="true" />
        {cols.map((c, i) => {
          const cell = row.cells[i]
          const text = typeof cell === 'string' ? cell : null
          const tone = row.tones?.[i] ?? (c.status && text ? toneFor(text) : 'ivory')
          return (
            <span key={c.key} role="cell" className={`drow__cell${c.align ? ' drow__cell--r' : ''}${c.status ? ' drow__cell--status' : ''}`}>
              {text !== null ? <Flap text={text} width={c.w} tone={tone} delay={delay + r * rowGap} maxFlips={maxFlips} stagger={stagger} /> : cell}
            </span>
          )
        })}
      </>
    )
    return row.href ? (
      <a
        className="drow drow--link"
        style={{ gridTemplateColumns: 'var(--cols)' }}
        role="row"
        href={row.href}
        onClick={(e) => {
          e.preventDefault()
          navigate(row.href as string)
        }}
      >
        {inner}
      </a>
    ) : (
      <div className="drow" style={{ gridTemplateColumns: 'var(--cols)' }} role="row">
        {inner}
      </div>
    )
  },
  (a, b) =>
    a.cols === b.cols &&
    a.r === b.r &&
    a.delay === b.delay &&
    a.rowGap === b.rowGap &&
    a.maxFlips === b.maxFlips &&
    a.stagger === b.stagger &&
    a.row.id === b.row.id &&
    a.row.light === b.row.light &&
    a.row.href === b.row.href &&
    sameArray(a.row.cells, b.row.cells) &&
    sameArray(a.row.tones, b.row.tones),
)

export function Board({ kicker, cols, rows, clock = false, delay = 0, rowGap = 420, footer, className = '', label, fs, maxFlips, stagger }: BoardProps) {
  // the row light sits in a narrow first track; max() keeps its distance to the first column constant
  const template = ['max(0px, calc(20px - var(--cg)))', ...cols.map((c) => `calc(var(--tw) * ${c.w})`)].join(' ')
  const style = { '--cols': template, ...(fs ? { '--fs': `${fs}px` } : {}) } as CSSProperties

  return (
    <div className={`dboard ${className}`} style={style} role="table" aria-label={label}>
      <div className="dboard__head">
        <span className="dboard__kicker">{kicker}</span>
        {clock && <Clock />}
      </div>
      <div className="dboard__scroll">
        <div className="dboard__table">
          <div className="drow drow--head" style={{ gridTemplateColumns: 'var(--cols)' }} role="row">
            <span aria-hidden="true" />
            {cols.map((c) => (
              <span key={c.key} role="columnheader" style={c.align ? { textAlign: 'right' } : undefined} className={c.status ? 'drow__cell--status' : undefined}>
                {c.label}
              </span>
            ))}
          </div>
          {rows.map((row, r) => (
            <Row key={row.id} row={row} cols={cols} r={r} delay={delay} rowGap={rowGap} maxFlips={maxFlips} stagger={stagger} />
          ))}
        </div>
      </div>
      {footer && <div className="dboard__foot">{footer}</div>}
    </div>
  )
}
