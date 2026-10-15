import { useEffect, useRef, useState } from 'react'
import type { Artist, ArtistLink, Discipline, LinkType, ThemeId } from '../types'
import { DISCIPLINE_LABEL, DISCIPLINE_THEME, THEMES, disciplinesOf } from '../lib/themes'
import { navigate } from '../lib/router'
import { saveMe } from '../lib/store'
import { Avatar } from '../components/Avatar'
import { LinkIcon } from '../components/LinkIcon'
import { LINK_LABEL } from '../lib/links'

const STEPS = ['Handle', 'Your craft', 'Your profile', 'Links', 'Look'] as const
const HANDLE_FIELDS: { type: LinkType; prefix: string; url: (v: string) => string }[] = [
  { type: 'instagram', prefix: '@', url: (v) => `https://www.instagram.com/${v}/` },
  { type: 'tiktok', prefix: '@', url: (v) => `https://www.tiktok.com/@${v}` },
  { type: 'spotify', prefix: 'artist/', url: (v) => `https://open.spotify.com/artist/${v}` },
  { type: 'youtube', prefix: '@', url: (v) => `https://www.youtube.com/@${v}` },
  { type: 'soundcloud', prefix: '/', url: (v) => `https://soundcloud.com/${v}` },
  { type: 'website', prefix: 'https://', url: (v) => `https://${v.replace(/^https?:\/\//, '')}` },
]

function handleFromLinks(links: ArtistLink[], type: LinkType): string {
  const l = links.find((x) => x.type === type)
  if (!l) return ''
  if (type === 'website') return l.url.replace(/^https?:\/\//, '')
  return l.url.replace(/^https?:\/\//, '').replace(/^(www\.)?[^/]+\/(@|artist\/)?/, '').replace(/\/$/, '')
}

export function Onboarding({ existing, taken, onDone }: { existing: Artist | null; taken: Set<string>; onDone: (me: Artist) => void }) {
  const [step, setStep] = useState(0)
  const [handle, setHandle] = useState(existing?.id ?? '')
  const [disciplines, setDisciplines] = useState<Discipline[]>(existing ? disciplinesOf(existing) : [])
  const [name, setName] = useState(existing?.name ?? '')
  const [tagline, setTagline] = useState(existing?.tagline ?? '')
  const [bio, setBio] = useState(existing?.bio ?? '')
  const [genres, setGenres] = useState(existing?.genres.join(', ') ?? '')
  const [photo, setPhoto] = useState<string | null>(existing?.photo?.src ?? null)
  const [handles, setHandles] = useState<Record<string, string>>(
    () => Object.fromEntries(HANDLE_FIELDS.map((f) => [f.type, existing ? handleFromLinks(existing.links, f.type) : ''])),
  )
  const [theme, setTheme] = useState<ThemeId | null>(existing?.theme ?? null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => { headingRef.current?.focus() }, [step])

  const cleanHandle = handle.toLowerCase().replace(/[^a-z0-9-]/g, '')
  const handleTaken = taken.has(cleanHandle)
  const primary = disciplines[0] ?? 'visual'
  const draft: Artist = {
    id: cleanHandle || 'you',
    name: name || 'Your name',
    discipline: primary,
    disciplines: disciplines.length ? disciplines : [primary],
    tagline: tagline || disciplines.map((d) => DISCIPLINE_LABEL[d]).join(' · '),
    bio,
    miami: ['lives'],
    occupations: disciplines.map((d) => DISCIPLINE_LABEL[d].toLowerCase()),
    genres: genres.split(',').map((g) => g.trim()).filter(Boolean).slice(0, 6),
    instruments: [],
    movements: [],
    links: HANDLE_FIELDS.filter((f) => handles[f.type]?.trim()).map((f) => ({ type: f.type, url: f.url(handles[f.type].trim().replace(/^@/, '')) })),
    photo: photo ? { src: photo, author: 'You', license: 'Your upload' } : null,
    sources: {},
    theme: theme ?? DISCIPLINE_THEME[primary],
    isLocal: true,
  }

  const canNext = [cleanHandle.length >= 3 && !handleTaken, disciplines.length > 0, name.trim().length > 1, true, true][step]

  function next() {
    if (!canNext) return
    if (step < STEPS.length - 1) return setStep(step + 1)
    saveMe(draft)
    onDone(draft)
    navigate(`/a/${draft.id}`)
  }

  function onPhoto(file?: File) {
    if (!file) return
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      const s = Math.min(img.width, img.height)
      c.width = c.height = 320
      c.getContext('2d')!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 320, 320)
      setPhoto(c.toDataURL('image/jpeg', 0.82))
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(file)
  }

  return (
    <main id="main" className="onboard">
      <div className="onboard-panel">
        <div className="progress" role="progressbar" aria-label="Profile setup" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-valuetext={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
          {STEPS.map((s, i) => <span key={s} className={i <= step ? 'on' : ''} />)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); next() }}>
          {step === 0 && (
            <>
              <h1 ref={headingRef} tabIndex={-1}>Claim your handle</h1>
              <p className="muted">This is your link. Share it anywhere.</p>
              <label className="field">
                <span>Handle</span>
                <span className="affix">
                  <span aria-hidden="true">converge.art/</span>
                  <input autoFocus value={handle} onChange={(e) => setHandle(e.target.value)} autoComplete="username" aria-describedby="handle-hint" maxLength={30} />
                </span>
              </label>
              <p id="handle-hint" className={`hint ${handleTaken ? 'error' : ''}`} aria-live="polite">
                {handleTaken ? 'That handle is taken. Try another.' : cleanHandle.length >= 3 ? `converge.art/${cleanHandle} is available` : 'At least 3 letters, numbers or dashes.'}
              </p>
            </>
          )}

          {step === 1 && (
            <fieldset>
              <legend><h1 ref={headingRef} tabIndex={-1}>What do you create?</h1></legend>
              <p className="muted">Pick all that apply. Your first pick sets your profile's starting look.</p>
              <div className="pick-grid">
                {(Object.keys(DISCIPLINE_LABEL) as Discipline[]).map((d) => (
                  <label key={d} className={`pick ${disciplines.includes(d) ? 'on' : ''}`}>
                    <input type="checkbox" checked={disciplines.includes(d)} onChange={() => setDisciplines((cur) => cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d])} />
                    {DISCIPLINE_LABEL[d]}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {step === 2 && (
            <>
              <h1 ref={headingRef} tabIndex={-1}>Your profile</h1>
              <p className="muted">Introduce yourself to other Miami artists.</p>
              <label className="photo-pick">
                <Avatar artist={draft} size={96} />
                <span className="photo-btn">{photo ? 'Change photo' : 'Add photo'}</span>
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
              </label>
              <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>
              <label className="field"><span>One-liner</span><input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Afro-Cuban percussionist and producer" /></label>
              <label className="field"><span>Bio</span><textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Share a little about your work and what you want to make next." /></label>
              <label className="field"><span>Styles and genres</span><input value={genres} onChange={(e) => setGenres(e.target.value)} placeholder="salsa, jazz, house" aria-describedby="genres-hint" /></label>
              <p id="genres-hint" className="hint">Separate with commas. These help the AI match you.</p>
            </>
          )}

          {step === 3 && (
            <>
              <h1 ref={headingRef} tabIndex={-1}>Add your links</h1>
              <p className="muted">Where can people see and hear your work? You can skip any.</p>
              <div className="handles">
                {HANDLE_FIELDS.map((f) => (
                  <label key={f.type} className="handle-row">
                    <LinkIcon type={f.type} />
                    <span className="handle-label">{LINK_LABEL[f.type]}</span>
                    <span className="handle-prefix" aria-hidden="true">{f.prefix}</span>
                    <input value={handles[f.type]} onChange={(e) => setHandles({ ...handles, [f.type]: e.target.value })} aria-label={`${LINK_LABEL[f.type]} handle`} />
                  </label>
                ))}
              </div>
            </>
          )}

          {step === 4 && (
            <fieldset>
              <legend><h1 ref={headingRef} tabIndex={-1}>Pick your look</h1></legend>
              <p className="muted">Every profile can look different. Change it any time.</p>
              <div className="theme-picker">
                {Object.values(THEMES).map((t) => (
                  <label key={t.id} className={`theme-swatch ${t.className} ${draft.theme === t.id ? 'on' : ''}`}>
                    <input type="radio" name="theme" className="sr-only" checked={draft.theme === t.id} onChange={() => setTheme(t.id)} />
                    <span className="swatch-art" aria-hidden="true" />
                    <span className="swatch-label">{t.label}</span>
                    <span className="swatch-desc">{t.description}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="onboard-actions">
            {step > 0 ? <button type="button" className="secondary" onClick={() => setStep(step - 1)}>Back</button> : <button type="button" className="secondary" onClick={() => navigate('/')}>Cancel</button>}
            <button type="submit" className="primary" disabled={!canNext}>{step === STEPS.length - 1 ? (existing ? 'Save profile' : 'Create profile') : 'Continue'}</button>
          </div>
        </form>
      </div>

      <aside className="onboard-preview" aria-label="Live preview">
        <div className={`phone ${THEMES[draft.theme!].className}`}>
          <div className="phone-bg" aria-hidden="true">{draft.photo && <img src={draft.photo.src} alt="" />}</div>
          <div className="phone-inner">
            <Avatar artist={draft} size={84} className="profile-avatar" />
            <p className="profile-kicker">{DISCIPLINE_LABEL[primary]}</p>
            <p className="profile-name">{draft.name}</p>
            <p className="profile-tagline">{draft.tagline}</p>
            <ul className="links">
              {(draft.links.length ? draft.links : [{ type: 'website' as const, url: '#' }]).map((l) => (
                <li key={l.type}><span className="link-btn"><LinkIcon type={l.type} /><span>{LINK_LABEL[l.type]}</span></span></li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </main>
  )
}
