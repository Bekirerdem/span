import { usePath } from './router'
import Board from './board/Board'
import OpenSpan from './app/OpenSpan'
import DealPage from './app/DealPage'

export default function App() {
  const path = usePath()
  const url = new URL(path, window.location.origin)
  const deal = /^\/s\/(\d+)\/?$/.exec(url.pathname)

  if (url.pathname === '/new') return <OpenSpan />
  if (deal) return <DealPage key={deal[1]} id={BigInt(deal[1])} title={url.searchParams.get('t')} />
  return <Board />
}
