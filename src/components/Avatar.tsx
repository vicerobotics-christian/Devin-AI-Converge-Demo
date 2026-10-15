import type { Artist } from '../types'
import { hueFor, initials } from '../lib/themes'

export function Avatar({ artist, size = 56, className = '' }: { artist: Pick<Artist, 'id' | 'name' | 'photo'>; size?: number; className?: string }) {
  const hue = hueFor(artist.id)
  return (
    <span className={`avatar ${className}`} style={{ width: size, height: size, '--hue': hue } as React.CSSProperties}>
      {artist.photo ? (
        <img src={artist.photo.src} alt="" loading="lazy" decoding="async" />
      ) : (
        <span aria-hidden="true" style={{ fontSize: size * 0.38 }}>{initials(artist.name)}</span>
      )}
    </span>
  )
}
