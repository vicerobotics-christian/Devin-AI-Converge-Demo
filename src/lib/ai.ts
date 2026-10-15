import type { Artist, Discipline, Intent, SearchHit } from '../types'
import { localReply, parseIntent, rank, VIBES } from './search'

const BRIDGE = import.meta.env.VITE_BRIDGE_URL ?? 'http://127.0.0.1:8787'
const VALID = new Set<Discipline>(['music', 'visual', 'photo', 'film', 'dance', 'writing', 'theater', 'design'])

export type Engine = 'checking' | 'on-device' | 'local'

async function post<T>(path: string, body: unknown, ms = 15000): Promise<T> {
  const res = await fetch(`${BRIDGE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(ms),
  })
  if (!res.ok) throw new Error(`bridge ${res.status}`)
  return res.json() as Promise<T>
}

export async function detectEngine(): Promise<Engine> {
  try {
    const res = await fetch(`${BRIDGE}/health`, { signal: AbortSignal.timeout(1200) })
    const data = (await res.json()) as { model?: string }
    return data.model === 'available' ? 'on-device' : 'local'
  } catch {
    return 'local'
  }
}

interface ModelIntent { disciplines: string[]; keywords: string[]; miami: string; summary: string }

export async function understand(query: string, engine: Engine): Promise<Intent> {
  const local = parseIntent(query)
  if (engine !== 'on-device') return local
  try {
    const m = await post<ModelIntent>('/intent', { query })
    const disciplines = [...new Set([...local.disciplines, ...m.disciplines.filter((d): d is Discipline => VALID.has(d as Discipline))])]
    const keywords = [...new Set([...local.keywords, ...m.keywords.flatMap((k) => k.toLowerCase().split(/\s+/))])].filter((k) => k.length > 2)
    const miami = m.miami === 'born' || m.miami === 'based' ? m.miami : local.miami
    const vibes = [...new Set([...local.vibes, ...m.keywords.map((k) => k.toLowerCase()).filter((k) => k in VIBES)])]
    return { disciplines, keywords: keywords.filter((k) => !(k in VIBES)), vibes, miami, summary: m.summary || local.summary }
  } catch {
    return local
  }
}

export async function search(query: string, artists: Artist[], engine: Engine) {
  const intent = await understand(query, engine)
  return { intent, hits: rank(artists, intent) }
}

export async function explain(query: string, intent: Intent, hits: SearchHit[], engine: Engine): Promise<string> {
  if (engine !== 'on-device' || !hits.length) return localReply(intent, hits)
  try {
    const { reply } = await post<{ reply: string }>('/reply', {
      query,
      candidates: hits.slice(0, 6).map((h) => ({ name: h.artist.name, tagline: h.artist.tagline || h.artist.occupations.join(', ') })),
    })
    return reply
  } catch {
    return localReply(intent, hits)
  }
}
