import './landing.css'
import './scenes.css'
import { useEffect, useLayoutEffect, useState } from 'react'
import { SpanLogo } from './SpanLogo'
import { Hero } from './scenes/Hero'
import { OldWay } from './scenes/OldWay'
import { Route } from './scenes/Route'
import { Rule } from './scenes/Rule'
import { LiveBoard } from './scenes/LiveBoard'
import { Close } from './scenes/Close'
import { scrollToId, startScroll } from './scroll'
import { navigate } from '../router'

function Nav() {
  const [solid, setSolid] = useState(false)
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const jump = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    scrollToId(id)
  }
  return (
    <header className={`nav${solid ? ' nav--solid' : ''}`}>
      <div className="wrap nav__in">
      <a className="nav__brand" href="/" onClick={jump('top')}>
        <SpanLogo size={26} />
        <b>Span</b>
        <span className="nav__tag">&middot; holding deposits on Arc</span>
      </a>
      <nav className="nav__links" aria-label="Sections">
        <a href="#how" onClick={jump('how')}>How it works</a>
        <a href="#rule" onClick={jump('rule')}>The rule</a>
        <a href="#live" onClick={jump('live')}>Live board</a>
      </nav>
      <a className="btn-primary btn-primary--sm" href="/new" onClick={(e) => (e.preventDefault(), navigate('/new'))}>
        Open a Span
      </a>
      </div>
    </header>
  )
}

export default function Landing() {
  useLayoutEffect(() => startScroll(), [])
  return (
    <div className="landing">
      <Nav />
      <main>
        <Hero />
        <OldWay />
        <Route />
        <Rule />
        <LiveBoard />
        <Close />
      </main>
    </div>
  )
}
