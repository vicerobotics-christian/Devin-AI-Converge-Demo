import type { Artist, Discipline, ThemeId } from '../types'

export interface Theme {
  id: ThemeId
  label: string
  description: string
  className: string
}

export const THEMES: Record<ThemeId, Theme> = {
  poster: { id: 'poster', label: 'Poster', description: 'Full-bleed photo, neon on black', className: 'theme-poster' },
  gallery: { id: 'gallery', label: 'Gallery', description: 'Gallery-white canvas, bold color blocks', className: 'theme-gallery' },
  mono: { id: 'mono', label: 'Darkroom', description: 'Black and white, monospaced captions', className: 'theme-mono' },
  cinema: { id: 'cinema', label: 'Cinema', description: 'Letterboxed, amber marquee type', className: 'theme-cinema' },
  flow: { id: 'flow', label: 'Flow', description: 'Warm sunset gradient, soft motion', className: 'theme-flow' },
  editorial: { id: 'editorial', label: 'Editorial', description: 'Paper, ink and serif type', className: 'theme-editorial' },
  stage: { id: 'stage', label: 'Stage', description: 'Velvet red with gold lettering', className: 'theme-stage' },
  grid: { id: 'grid', label: 'Blueprint', description: 'Electric blue on a design grid', className: 'theme-grid' },
}

export const DISCIPLINE_THEME: Record<Discipline, ThemeId> = {
  music: 'poster',
  visual: 'gallery',
  photo: 'mono',
  film: 'cinema',
  dance: 'flow',
  writing: 'editorial',
  theater: 'stage',
  design: 'grid',
}

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  music: 'Music',
  visual: 'Visual art',
  photo: 'Photography',
  film: 'Film',
  dance: 'Dance',
  writing: 'Writing',
  theater: 'Acting',
  design: 'Design',
}

export function disciplinesOf(artist: Artist): Discipline[] {
  return artist.disciplines?.length ? artist.disciplines : [artist.discipline]
}

export function themeFor(artist: Artist): Theme {
  return THEMES[artist.theme ?? DISCIPLINE_THEME[artist.discipline]]
}

export function hueFor(id: string): number {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}
