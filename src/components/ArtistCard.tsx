import type { Artist } from '../types'
import { DISCIPLINE_LABEL, themeFor } from '../lib/themes'
import { linkProps } from '../lib/router'
import { Avatar } from './Avatar'

export function ArtistCard({ artist, reasons = [] }: { artist: Artist; reasons?: string[] }) {
  const theme = themeFor(artist)
  return (
    <li className={`card ${theme.className}`}>
      <a className="card-link" {...linkProps(`/a/${artist.id}`)}>
        <Avatar artist={artist} size={64} />
        <span className="card-body">
          <span className="card-name">{artist.name}</span>
          <span className="card-tagline">{artist.tagline || artist.occupations.slice(0, 2).join(', ')}</span>
          <span className="chips" aria-label="Highlights">
            <span className="chip chip-strong">{DISCIPLINE_LABEL[artist.discipline]}</span>
            {(reasons.length ? reasons : artist.genres.slice(0, 2)).filter((r) => r !== DISCIPLINE_LABEL[artist.discipline]).slice(0, 2).map((r) => (
              <span className="chip" key={r}>{r}</span>
            ))}
          </span>
        </span>
      </a>
    </li>
  )
}
