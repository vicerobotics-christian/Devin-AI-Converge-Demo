import { useEffect, useRef, useState } from 'react'
import type { Artist, Discipline, SearchHit } from '../types'
import { explain, search, type Engine } from '../lib/ai'
import { DISCIPLINE_LABEL, disciplinesOf } from '../lib/themes'
import { ArtistCard } from '../components/ArtistCard'

const PROMPTS = [
  'Upbeat artists to remix my next single',
  'A Miami-born reggaeton producer for my next single',
  'Mellow, soulful singers for an acoustic set',
  'A muralist to paint a wall in Wynwood',
  'A photographer for portraits and an album cover',
  'A film director to shoot my music video',
  'A poet or writer for a spoken word collab',
  'Dancers and a choreographer for a live show',
]

interface Props { artists: Artist[]; engine: Engine; me: Artist | null }

export function Home({ artists, engine, me }: Props) {
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get('q') ?? '')
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState('')
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const [filter, setFilter] = useState<Discipline | null>(null)
  const runId = useRef(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  async function run(q: string) {
    const text = q.trim()
    if (!text) return
    const id = ++runId.current
    setBusy(true)
    setReply('')
    setFilter(null)
    history.replaceState(null, '', `/?q=${encodeURIComponent(text)}`)
    const { intent, hits } = await search(text, artists, engine)
    if (id !== runId.current) return
    setHits(hits)
    setBusy(false)
    const r = await explain(text, intent, hits, engine)
    if (id === runId.current) setReply(r)
  }

  useEffect(() => {
    if (query && engine !== 'checking' && hits === null) run(query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine])

  function cancelSearch() {
    runId.current++
    setBusy(false)
    setHits(null)
    setReply('')
  }

  const browse = filter ? artists.filter((a) => disciplinesOf(a).includes(filter)) : artists
  const shown = hits ?? browse.map((artist) => ({ artist, score: 0, reasons: [] }))

  return (
    <main id="main">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-glow" aria-hidden="true" />
        <p className="hero-pill">
          <span className={`dot dot-${engine}`} aria-hidden="true" />
          {engine === 'on-device' ? 'On-device Apple Intelligence' : engine === 'checking' ? 'Connecting…' : 'Smart local search'}
          <span className="sr-only"> is powering search</span>
        </p>
        <h1 id="hero-title">{me ? `Who are you looking for, ${me.name.split(' ')[0]}?` : 'Find your next Miami collaborator'}</h1>
        <p className="hero-sub">{artists.length} Miami artists across music, art, film, dance, words and more.</p>
        <form className="prompt" role="search" onSubmit={(e) => { e.preventDefault(); run(query) }}>
          <label htmlFor="prompt-input" className="sr-only">Describe who you want to collaborate with</label>
          <textarea
            id="prompt-input"
            ref={inputRef}
            rows={2}
            value={query}
            placeholder="Ask for the artist you need, e.g. a jazz pianist for a Little Havana gig…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(query) } }}
          />
          <div className="prompt-row">
            <div className="prompt-chips">
              {(Object.keys(DISCIPLINE_LABEL) as Discipline[]).slice(0, 4).map((d) => (
                <button type="button" key={d} className="ghost-chip" onClick={() => { cancelSearch(); setFilter(d); document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }) }}>
                  {DISCIPLINE_LABEL[d]}
                </button>
              ))}
            </div>
            <button type="submit" className="send" disabled={!query.trim() || busy} aria-label="Search">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </form>
        <ul className="suggestions" aria-label="Example requests">
          {PROMPTS.map((p) => (
            <li key={p}><button type="button" onClick={() => { setQuery(p); run(p) }}>{p}</button></li>
          ))}
        </ul>
      </section>

      <section id="results" className="results" aria-labelledby="results-title">
        <div className="results-head">
          <h2 id="results-title">{hits ? 'Matches' : filter ? DISCIPLINE_LABEL[filter] : 'Explore Miami artists'}</h2>
          {!hits && (
            <div className="filters" role="group" aria-label="Filter by discipline">
              <button type="button" aria-pressed={!filter} onClick={() => setFilter(null)}>All</button>
              {(Object.keys(DISCIPLINE_LABEL) as Discipline[]).map((d) => (
                <button type="button" key={d} aria-pressed={filter === d} onClick={() => setFilter(d)}>{DISCIPLINE_LABEL[d]}</button>
              ))}
            </div>
          )}
          {hits && <button type="button" className="text-button" onClick={() => { cancelSearch(); setQuery(''); history.replaceState(null, '', '/'); inputRef.current?.focus() }}>Clear search</button>}
        </div>
        <div aria-live="polite" className="ai-reply-wrap">
          {busy && <p className="ai-reply thinking">Thinking{engine === 'on-device' ? ' on-device' : ''}…</p>}
          {!busy && hits && <p className="ai-reply">{reply || (engine === 'on-device' ? 'Writing a summary on-device…' : '')}<span className="sr-only">{` ${hits.length} matches.`}</span></p>}
        </div>
        <ul className="grid">
          {shown.map((h) => <ArtistCard key={h.artist.id} artist={h.artist} reasons={h.reasons} />)}
        </ul>
      </section>
    </main>
  )
}
