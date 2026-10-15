export type Discipline = 'music' | 'visual' | 'photo' | 'film' | 'dance' | 'writing' | 'theater' | 'design'

export type LinkType =
  | 'website' | 'instagram' | 'x' | 'tiktok' | 'youtube' | 'spotify' | 'soundcloud'
  | 'bandcamp' | 'applemusic' | 'facebook' | 'imdb' | 'wikipedia'

export interface ArtistLink {
  type: LinkType
  url: string
}

export interface Photo {
  src: string
  page?: string
  author: string
  license: string
}

export interface Artist {
  id: string
  name: string
  discipline: Discipline
  disciplines?: Discipline[]
  tagline: string
  bio: string
  miami: ('born' | 'lives' | 'works')[]
  occupations: string[]
  genres: string[]
  genreSource?: string
  email?: string | null
  instruments: string[]
  movements: string[]
  links: ArtistLink[]
  photo: Photo | null
  sources: { wikipedia?: string; wikidata?: string }
  theme?: ThemeId
  isLocal?: boolean
}

export type ThemeId = 'poster' | 'gallery' | 'mono' | 'cinema' | 'flow' | 'editorial' | 'stage' | 'grid'

export interface Intent {
  disciplines: Discipline[]
  keywords: string[]
  vibes: string[]
  miami?: 'born' | 'based'
  summary: string
}

export interface SearchHit {
  artist: Artist
  score: number
  reasons: string[]
}
