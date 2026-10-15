import type { Artist } from '../types'
import { DISCIPLINE_LABEL, themeFor } from '../lib/themes'
import { linkProps } from '../lib/router'
import { vibesFor } from '../lib/search'
import { Avatar } from '../components/Avatar'
import { LinkIcon } from '../components/LinkIcon'
import { LINK_LABEL } from '../lib/links'

const MIAMI_LABEL = { born: 'Born in Miami', lives: 'Lives in Miami', works: 'Works in Miami' } as const

function handleOf(url: string) {
  return url.replace(/\/$/, '').split('/').pop() ?? ''
}

function ReachOut({ artist, me }: { artist: Artist; me: Artist | null }) {
  const site = artist.links.find((l) => l.type === 'website')
  const ig = artist.links.find((l) => l.type === 'instagram')
  const x = artist.links.find((l) => l.type === 'x')
  const intro = me
    ? `Hi ${artist.name}, I'm ${me.name}, a Miami ${DISCIPLINE_LABEL[me.discipline].toLowerCase()} artist. I found you on Converge and would love to talk about a collaboration. My profile: ${location.origin}/a/${me.id}`
    : `Hi ${artist.name}, I found you on Converge and would love to talk about a collaboration.`
  const options = [
    artist.email && { label: 'Email', detail: artist.email, href: `mailto:${artist.email}?subject=${encodeURIComponent('Collaboration via Converge')}&body=${encodeURIComponent(intro)}`, note: 'Official email listed on Wikidata' },
    ig && { label: 'Instagram DM', detail: `@${handleOf(ig.url)}`, href: `https://ig.me/m/${handleOf(ig.url)}`, note: 'Opens a direct message' },
    site && { label: 'Official website', detail: new URL(site.url).hostname.replace(/^www\./, ''), href: site.url, note: 'Look for booking or management contacts' },
    x && { label: 'X', detail: `@${handleOf(x.url)}`, href: x.url, note: 'Public profile' },
  ].filter(Boolean) as { label: string; detail: string; href: string; note: string }[]

  return (
    <section className="profile-section reach" aria-labelledby="reach">
      <h2 id="reach">Reach out</h2>
      {options.length ? (
        <>
          <ul className="reach-list">
            {options.map((o) => (
              <li key={o.label}>
                <a href={o.href} target={o.href.startsWith('mailto:') ? undefined : '_blank'} rel="noopener noreferrer">
                  <span className="reach-label">{o.label}</span>
                  <span className="reach-detail">{o.detail}</span>
                  <span className="reach-note">{o.note}{o.href.startsWith('mailto:') ? '' : <span className="sr-only"> (opens in a new tab)</span>}</span>
                </a>
              </li>
            ))}
          </ul>
          <details className="reach-intro">
            <summary>Suggested intro message</summary>
            <p>{intro}</p>
            <button type="button" className="secondary" onClick={() => navigator.clipboard?.writeText(intro)}>Copy message</button>
          </details>
        </>
      ) : (
        <p>No public contact is listed. Try the links above.</p>
      )}
    </section>
  )
}

export function Profile({ artist, me, onEdit }: { artist: Artist; me: Artist | null; onEdit?: () => void }) {
  const theme = themeFor(artist)
  const links = [...artist.links, ...(artist.sources.wikipedia ? [{ type: 'wikipedia' as const, url: artist.sources.wikipedia }] : [])]
  const tags = [...new Set([...artist.instruments, ...artist.movements, ...artist.occupations])].slice(0, 8)
  const vibes = vibesFor(artist.genres)

  return (
    <main id="main" className={`profile ${theme.className}`}>
      <div className="profile-bg" aria-hidden="true">
        {artist.photo && <img src={artist.photo.src} alt="" />}
      </div>
      <article className="profile-inner">
        <a className="back" {...linkProps('/')}>← Back to search</a>
        <header className="profile-head">
          <Avatar artist={artist} size={128} className="profile-avatar" />
          <p className="profile-kicker">{DISCIPLINE_LABEL[artist.discipline]}</p>
          <h1 className="profile-name">{artist.name}</h1>
          {artist.tagline && <p className="profile-tagline">{artist.tagline}</p>}
          <ul className="miami" aria-label="Miami connection">
            {artist.miami.map((m) => <li key={m}>{MIAMI_LABEL[m]}</li>)}
          </ul>
        </header>

        {links.length > 0 && (
          <nav aria-label={`${artist.name} links`}>
            <ul className="links">
              {links.map((l) => (
                <li key={l.url}>
                  <a className="link-btn" href={l.url} target="_blank" rel="noopener noreferrer">
                    <LinkIcon type={l.type} />
                    <span>{LINK_LABEL[l.type]}</span>
                    <span className="sr-only"> (opens in a new tab)</span>
                    <span aria-hidden="true" className="arrow">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {artist.bio && (
          <section className="profile-section" aria-labelledby="about">
            <h2 id="about">About</h2>
            <p>{artist.bio}</p>
          </section>
        )}

        {artist.genres.length > 0 && (
          <section className="profile-section" aria-labelledby="sound">
            <h2 id="sound">Sound and style</h2>
            {vibes.length > 0 && <ul className="chips vibes" aria-label="Vibes">{vibes.map((v) => <li className="chip chip-vibe" key={v}>{v}</li>)}</ul>}
            <ul className="chips" aria-label="Genres">{artist.genres.map((t) => <li className="chip" key={t}>{t}</li>)}</ul>
            {artist.genreSource && <p className="source-note">Genres from {artist.genreSource}</p>}
          </section>
        )}

        {tags.length > 0 && (
          <section className="profile-section" aria-labelledby="tags">
            <h2 id="tags">Roles</h2>
            <ul className="chips">{tags.map((t) => <li className="chip" key={t}>{t}</li>)}</ul>
          </section>
        )}

        {!artist.isLocal && <ReachOut artist={artist} me={me} />}

        {onEdit && <button type="button" className="primary" onClick={onEdit}>Edit profile</button>}

        <footer className="profile-credits">
          {artist.isLocal ? (
            <p>Demo profile stored only in this browser.</p>
          ) : (
            <p>
              Public information from{' '}
              {artist.sources.wikipedia && <a href={artist.sources.wikipedia} target="_blank" rel="noopener noreferrer">Wikipedia</a>} (CC BY-SA) and{' '}
              {artist.sources.wikidata && <a href={artist.sources.wikidata} target="_blank" rel="noopener noreferrer">Wikidata</a>}.
              {artist.photo && (
                <> Photo: {artist.photo.page ? <a href={artist.photo.page} target="_blank" rel="noopener noreferrer">{artist.photo.author}</a> : artist.photo.author}, {artist.photo.license}.</>
              )}{' '}
              This demo isn't affiliated with or endorsed by {artist.name}.
            </p>
          )}
        </footer>
      </article>
    </main>
  )
}
