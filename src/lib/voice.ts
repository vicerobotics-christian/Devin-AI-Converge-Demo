import { useCallback, useEffect, useRef, useState } from 'react'

interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

const Ctor: RecognitionCtor | undefined = typeof window === 'undefined'
  ? undefined
  : ((window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition)

export type VoiceState = 'idle' | 'listening' | 'error'

const QUIET_MS = 1500
const MAX_TURN_MS = 25000
const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access was blocked. Allow it in your browser to talk.',
  'service-not-allowed': 'Microphone access was blocked. Allow it in your browser to talk.',
  'no-speech': "I didn't hear anything. Tap the mic and try again.",
  'audio-capture': 'No microphone was found.',
  network: 'Voice needs a network connection in this browser.',
}

export function useVoiceInput(onText: (text: string) => void, onDone: (text: string) => void) {
  const [state, setState] = useState<VoiceState>('idle')
  const [error, setError] = useState('')
  const rec = useRef<Recognition | null>(null)
  const text = useRef('')
  const quietTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = () => {
    if (quietTimer.current) clearTimeout(quietTimer.current)
    if (maxTimer.current) clearTimeout(maxTimer.current)
  }

  const stop = useCallback(() => {
    clearTimers()
    rec.current?.stop()
  }, [])

  const start = useCallback(() => {
    if (!Ctor || rec.current) return
    const r = new Ctor()
    r.lang = navigator.language || 'en-US'
    r.interimResults = true
    r.continuous = true
    text.current = ''
    setError('')
    r.onresult = (e) => {
      let finalText = ''
      let interim = ''
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) finalText += res[0].transcript
        else interim += res[0].transcript
      }
      text.current = `${finalText}${interim}`.trim()
      onText(text.current)
      if (quietTimer.current) clearTimeout(quietTimer.current)
      quietTimer.current = setTimeout(() => r.stop(), QUIET_MS)
    }
    r.onerror = (e) => {
      if (e.error === 'aborted') return
      setError(ERRORS[e.error] ?? "Voice isn't available right now. Type your request instead.")
      setState('error')
    }
    r.onend = () => {
      clearTimers()
      rec.current = null
      setState((s) => (s === 'error' ? s : 'idle'))
      if (text.current) onDone(text.current)
    }
    rec.current = r
    maxTimer.current = setTimeout(() => r.stop(), MAX_TURN_MS)
    setState('listening')
    r.start()
  }, [onText, onDone])

  useEffect(() => () => { clearTimers(); rec.current?.abort() }, [])

  return { supported: Boolean(Ctor), state, error, start, stop }
}
