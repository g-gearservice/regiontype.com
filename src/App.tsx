import { useEffect, useRef, useState } from 'react'
import { REGIONS, VIEWBOX } from './regions'

const DURATION = 60
const norm = (s: string) => s.replace(/\s/g, '')
const match = (v: string) => REGIONS.find(r => r.aliases.some(a => norm(a) === v))

export default function App() {
  const [painted, setPainted] = useState<string[]>([])
  const [last, setLast] = useState<string | null>(null)
  const [left, setLeft] = useState(DURATION)
  const [strokes, setStrokes] = useState(0)
  const [shake, setShake] = useState(false)
  // remounting the input is the only reliable way to drop a half-composed
  // Hangul syllable out of the IME buffer. ponytail: fine for a prototype.
  const [inputKey, setInputKey] = useState(0)
  const ref = useRef<HTMLInputElement>(null)

  const running = left > 0

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setLeft(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [running])

  useEffect(() => { ref.current?.focus() }, [inputKey, running])

  // Called on every keystroke AND on every IME composition update, so a
  // fully-composed region name scores the instant it appears — no Enter.
  const judge = (el: HTMLInputElement) => {
    const v = norm(el.value)
    if (!v) return
    const hit = match(v)
    if (!hit) return
    if (!painted.includes(hit.id)) {
      setPainted(p => [...p, hit.id])
      setLast(hit.id)
    }
    el.value = ''
    setInputKey(k => k + 1)
  }

  const restart = () => {
    setPainted([]); setLast(null); setStrokes(0); setLeft(DURATION); setInputKey(k => k + 1)
  }

  return (
    <>
      <div className="hud">
        <span>남은 시간 <b>{Math.max(left, 0)}</b>초</span>
        <span>칠한 곳 <b>{painted.length}</b>/{REGIONS.length}</span>
        <span>타수 <b>{strokes}</b></span>
      </div>

      <svg className="map" viewBox={VIEWBOX}>
        {REGIONS.map(r => (
          <path
            key={r.id}
            d={r.d}
            className={painted.includes(r.id) ? (r.id === last ? 'hit' : 'on') : ''}
          />
        ))}
      </svg>

      {running ? (
        <input
          key={inputKey}
          ref={ref}
          className={shake ? 'shake' : ''}
          placeholder="시/도 이름을 입력"
          autoComplete="off"
          onAnimationEnd={() => setShake(false)}
          onKeyDown={e => { if (e.key.length === 1) setStrokes(s => s + 1) }}
          onInput={e => judge(e.currentTarget)}
          onCompositionUpdate={e => judge(e.currentTarget)}
          onCompositionEnd={e => judge(e.currentTarget)}
          onKeyUp={e => {
            if (e.key !== 'Enter' || !e.currentTarget.value) return
            setShake(true)
            e.currentTarget.value = ''
            setInputKey(k => k + 1)
          }}
        />
      ) : (
        <div className="done">
          <p>{painted.length} / {REGIONS.length} · 타수 {strokes}</p>
          <button onClick={restart}>다시하기</button>
        </div>
      )}
    </>
  )
}
