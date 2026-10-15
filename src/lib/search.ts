import type { Artist, Discipline, Intent, SearchHit } from '../types'
import { DISCIPLINE_LABEL, disciplinesOf } from './themes'

const SYNONYMS: Record<Discipline, string[]> = {
  music: ['music', 'musician', 'singer', 'vocalist', 'rapper', 'rap', 'hip hop', 'hip-hop', 'producer', 'beat', 'beats', 'dj', 'band', 'composer', 'songwriter', 'guitarist', 'drummer', 'pianist', 'reggaeton', 'latin', 'salsa', 'jazz', 'r&b', 'pop', 'feature', 'verse', 'hook', 'song', 'album', 'track', 'edm', 'house'],
  visual: ['painter', 'painting', 'mural', 'muralist', 'visual', 'sculptor', 'sculpture', 'illustrator', 'illustration', 'printmaker', 'installation', 'gallery', 'cover art', 'artwork', 'canvas', 'street art'],
  photo: ['photographer', 'photography', 'photo', 'photos', 'photoshoot', 'shoot', 'portrait', 'portraits', 'headshots', 'camera'],
  film: ['film', 'filmmaker', 'director', 'cinematographer', 'video', 'music video', 'documentary', 'movie', 'editor', 'screenwriter', 'short film', 'visuals'],
  dance: ['dance', 'dancer', 'choreographer', 'choreography', 'ballet', 'movement', 'performer'],
  writing: ['writer', 'author', 'poet', 'poetry', 'novelist', 'lyricist', 'lyrics', 'essay', 'script', 'story', 'words', 'spoken word'],
  theater: ['actor', 'actress', 'acting', 'theater', 'theatre', 'stage', 'broadway', 'play', 'musical'],
  design: ['designer', 'design', 'graphic', 'fashion', 'branding', 'logo', 'architect', 'merch'],
}

// Vibes map mood words in a request to genres that usually carry that feel.
export const VIBES: Record<string, { words: string[]; genres: RegExp }> = {
  upbeat: {
    words: ['upbeat', 'energetic', 'high energy', 'high-energy', 'party', 'dance', 'danceable', 'club', 'hype', 'festival', 'fun', 'happy', 'summer'],
    genres: /house|edm|electro|dance|techno|trance|disco|reggaeton|dancehall|moombahton|dembow|pop|funk|freestyle|miami bass|bass music|drum and bass|dubstep|trap|salsa|merengue|bachata|cumbia|latin|afrobeat|soca|big room/,
  },
  mellow: {
    words: ['mellow', 'chill', 'calm', 'soft', 'smooth', 'relaxed', 'laid back', 'laid-back', 'acoustic', 'intimate', 'soulful', 'moody'],
    genres: /jazz|soul|blues|folk|acoustic|ambient|singer-songwriter|bossa|lo-fi|downtempo|classical|bolero|r&b|rhythm and blues|indie|chamber|lounge|neo soul/,
  },
  heavy: {
    words: ['heavy', 'hard', 'loud', 'aggressive', 'dark', 'edgy', 'raw', 'gritty'],
    genres: /metal|punk|hardcore|grunge|industrial|rock|noise|drill|horrorcore|death/,
  },
  romantic: {
    words: ['romantic', 'love song', 'ballad', 'ballads', 'sensual'],
    genres: /ballad|bolero|latin pop|r&b|soul|bachata|romantic|soft rock/,
  },
}

const STOP = new Set('a an and are as at be by can for from find get help i in into is it looking me my need of on or show someone somebody that the to who with want wants would like people person artist artists miami florida fl local nearby music'.split(' '))

function tokens(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9&\s-]/g, ' ').split(/\s+/).filter(Boolean)
}

export function vibesFor(genres: string[]): string[] {
  const text = genres.join(' | ').toLowerCase()
  return Object.entries(VIBES).filter(([, v]) => v.genres.test(text)).map(([k]) => k)
}

export function parseIntent(query: string): Intent {
  const q = ` ${query.toLowerCase()} `
  const has = (s: string) => q.includes(` ${s} `) || q.includes(` ${s}s `) || q.includes(` ${s},`) || q.includes(` ${s}.`)
  const disciplines = (Object.keys(SYNONYMS) as Discipline[]).filter((d) => SYNONYMS[d].some(has))
  const vibes = Object.entries(VIBES).filter(([, v]) => v.words.some(has)).map(([k]) => k)
  if (vibes.length && !disciplines.length) disciplines.push('music')
  const vibeWords = new Set(Object.values(VIBES).flatMap((v) => v.words))
  const miami = /\b(born|native|grew up|raised)\b/.test(q) ? 'born' : /\b(based|lives|living|local)\b/.test(q) ? 'based' : undefined
  const keywords = tokens(query).filter((t) => !STOP.has(t) && !vibeWords.has(t) && t.length > 2)
  const parts = [
    ...vibes,
    ...disciplines.map((d) => DISCIPLINE_LABEL[d].toLowerCase()),
  ]
  const summary = parts.length
    ? `Looking for ${parts.join(' + ')}${keywords.length ? ` · ${keywords.slice(0, 4).join(', ')}` : ''}`
    : keywords.length ? `Looking for: ${keywords.slice(0, 5).join(', ')}` : 'Browsing Miami artists'
  return { disciplines, keywords, vibes, miami, summary }
}

function haystack(a: Artist): string {
  return [a.name, a.tagline, a.bio, ...a.occupations, ...a.genres, ...a.instruments, ...a.movements].join(' ').toLowerCase()
}

const cache = new WeakMap<Artist, string>()

export function rank(artists: Artist[], intent: Intent, limit = 24): SearchHit[] {
  const hits: SearchHit[] = []
  for (const artist of artists) {
    let text = cache.get(artist)
    if (!text) cache.set(artist, (text = haystack(artist)))
    let score = 0
    const reasons: string[] = []
    const matched = disciplinesOf(artist).find((d) => intent.disciplines.includes(d))
    if (matched) {
      score += matched === artist.discipline ? 6 : 4
      reasons.push(DISCIPLINE_LABEL[matched])
    }
    for (const v of intent.vibes) {
      const g = artist.genres.find((x) => VIBES[v]?.genres.test(x.toLowerCase()))
      if (g) {
        score += 5
        reasons.push(`${v[0].toUpperCase()}${v.slice(1)} · ${g}`)
      }
    }
    for (const k of intent.keywords) {
      const tagMatch = [...artist.genres, ...artist.occupations, ...artist.instruments, ...artist.movements].find((t) => t.toLowerCase().includes(k))
      if (tagMatch) {
        score += 3
        if (!reasons.includes(tagMatch)) reasons.push(tagMatch)
      } else if (text.includes(k)) score += 1
      if (artist.name.toLowerCase().includes(k)) score += 8
    }
    if (intent.miami === 'born' && artist.miami.includes('born')) { score += 2; reasons.push('Miami-born') }
    if (intent.miami === 'based' && (artist.miami.includes('lives') || artist.miami.includes('works'))) { score += 2; reasons.push('Miami-based') }
    if (intent.vibes.length && !reasons.some((r) => r.includes(' · '))) score *= 0.4
    if (score > 0) hits.push({ artist, score: score + artist.links.length * 0.05, reasons: reasons.slice(0, 3) })
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit)
}

export function localReply(intent: Intent, hits: SearchHit[]): string {
  if (!hits.length) return "I couldn't find a strong match. Try a discipline (\"producer\", \"muralist\"), a vibe (\"upbeat\", \"mellow\"), a genre, or a name."
  const top = hits.slice(0, 3).map((h) => h.artist.name).join(', ')
  return `${intent.summary}. Strongest matches: ${top}.`
}
