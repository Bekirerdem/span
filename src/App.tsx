import { usePath } from './router'
import { Backdrop } from './dep/Backdrop'
import Landing from './dep/Landing'
import OpenSpan from './app/OpenSpan'
import DealPage from './app/DealPage'

export default function App() {
  const path = usePath()
  const url = new URL(path, window.location.origin)
  const deal = /^\/s\/(\d+)\/?$/.exec(url.pathname)

  return (
    <>
      <Backdrop />
      {url.pathname === '/new' ? (
        <OpenSpan />
      ) : deal ? (
        <DealPage key={deal[1]} id={BigInt(deal[1])} title={url.searchParams.get('t')} />
      ) : (
        <Landing />
      )}
    </>
  )
}
