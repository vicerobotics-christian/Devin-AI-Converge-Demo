import type { Artist } from '../types'

const KEY = 'converge.me'

export function loadMe(): Artist | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Artist) : null
  } catch {
    return null
  }
}

export function saveMe(me: Artist) {
  localStorage.setItem(KEY, JSON.stringify(me))
}

export function clearMe() {
  localStorage.removeItem(KEY)
}
