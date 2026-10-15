import { useEffect, useMemo, useState } from 'react'
import data from './data/artists.json'
import type { Artist } from './types'
import { detectEngine, type Engine } from './lib/ai'
import { linkProps, navigate, usePath } from './lib/router'
import { clearMe, loadMe } from './lib/store'
import { Avatar } from './components/Avatar'
import { Home } from './pages/Home'
import { Profile } from './pages/Profile'
import { Onboarding } from './pages/Onboarding'

const SEED = (data as { artists: Artist[] }).artists

function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s)
  } catch {
    return null
  }
}

export default function App() {
  const path = usePath()
  const [engine, setEngine] = useState<Engine>('checking')
  const [me, setMe] = useState<Artist | null>(loadMe)

  useEffect(() => { detectEngine().then(setEngine) }, [])

  const artists = useMemo(() => (me ? [me, ...SEED.filter((a) => a.id !== me.id)] : SEED), [me])
  const taken = useMemo(() => new Set(SEED.map((a) => a.id)), [])
  const profileId = path.startsWith('/a/') ? safeDecode(path.slice(3)) : null
  const qid = /^\/wd\/(Q\d+)$/.exec(path)?.[1]
  const profile = qid
    ? artists.find((a) => a.sources.wikidata?.endsWith(`/${qid}`))
    : profileId ? artists.find((a) => a.id === profileId) : undefined

  let page: React.ReactNode
  if (path === '/join' || path === '/edit') {
    page = <Onboarding key={path} existing={path === '/edit' ? me : null} taken={taken} onDone={setMe} />
  } else if (path.startsWith('/a/') || path.startsWith('/wd/')) {
    page = profile
      ? <Profile artist={profile} me={me} onEdit={profile.isLocal ? () => navigate('/edit') : undefined} />
      : <main id="main" className="empty"><h1>Profile not found</h1><a {...linkProps('/')}>Back to search</a></main>
  } else {
    page = <Home artists={artists} engine={engine} me={me} />
  }

  useEffect(() => {
    document.title = profile ? `${profile.name} · Converge` : path === '/join' ? 'Join · Converge' : 'Converge · Miami artists'
  }, [path, profile])

  return (
    <>
      <a href="#main" className="skip">Skip to content</a>
      <header className="topbar">
        <a className="brand" {...linkProps('/')}>
          <span className="brand-mark" aria-hidden="true" />
          Converge
        </a>
        <nav aria-label="Account">
          {me ? (
            <div className="me">
              <a className="me-link" {...linkProps(`/a/${me.id}`)}>
                <Avatar artist={me} size={32} />
                <span>My profile</span>
              </a>
              <button type="button" className="text-button" onClick={() => { clearMe(); setMe(null); navigate('/') }}>Sign out</button>
            </div>
          ) : (
            <a className="primary small" {...linkProps('/join')}>Create your profile</a>
          )}
        </nav>
      </header>
      {page}
    </>
  )
}
