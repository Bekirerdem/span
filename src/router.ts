import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  window.addEventListener('popstate', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('popstate', cb)
  }
}

export function navigate(path: string) {
  window.history.pushState({}, '', path)
  listeners.forEach((cb) => cb())
  window.scrollTo({ top: 0 })
}

export function usePath() {
  return useSyncExternalStore(subscribe, () => window.location.pathname + window.location.search)
}
