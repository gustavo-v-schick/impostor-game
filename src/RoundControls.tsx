import { useEffect, useRef, useState } from 'react'

interface RevealProps {
  hold: boolean
  onReveal: () => void
}

const HOLD_MS = 650

export function RevealButton({ hold, onReveal }: RevealProps) {
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pressing, setPressing] = useState(false)

  function stop(): void {
    if (timeout.current !== null) clearTimeout(timeout.current)
    timeout.current = null
    setPressing(false)
  }

  useEffect(() => () => {
    if (timeout.current !== null) clearTimeout(timeout.current)
  }, [])

  return (
    <button
      type="button"
      className={'primary full-width reveal-button' + (pressing ? ' pressing' : '')}
      onPointerDown={(event) => {
        if (!hold || !event.isPrimary || event.button !== 0 || timeout.current !== null) return
        setPressing(true)
        timeout.current = setTimeout(() => {
          timeout.current = null
          onReveal()
        }, HOLD_MS)
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onContextMenu={(event) => { if (hold) event.preventDefault() }}
      onClick={(event) => {
        if (!hold || event.detail === 0) onReveal()
      }}
    >
      {hold ? 'Segure para revelar' : 'Revelar minha informação'}
    </button>
  )
}

export function DiscussionTimer({ seconds }: { seconds: number }) {
  const [deadline] = useState(() => Date.now() + seconds * 1000)
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    update()
    const interval = setInterval(update, 250)
    return () => clearInterval(interval)
  }, [deadline])

  const display = Math.floor(remaining / 60) + ':' + String(remaining % 60).padStart(2, '0')
  return (
    <div className="secret discussion-timer" data-ended={remaining === 0}>
      <p className="muted">{remaining === 0 ? 'Tempo encerrado' : 'Tempo de discussão'}</p>
      <p className="secret-value" role="timer" aria-label={'Tempo restante: ' + display}>{display}</p>
      <progress className="progress timer-progress" max={seconds} value={remaining} aria-label="Proporção do tempo restante" />
      {remaining === 0 && <p role="status">Hora de votar!</p>}
    </div>
  )
}

export function GameMark({ kind }: { kind: 'eye' | 'lock' | 'shield' | 'chat' }) {
  return <span className={'game-mark mark-' + kind} aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'eye' && <><path d="M4 24Q24 3 44 24Q24 45 4 24Z" /><circle cx="24" cy="24" r="7" /><path d="M24 3v5M24 40v5" /></>}
      {kind === 'lock' && <><rect x="10" y="21" width="28" height="21" rx="5" /><path d="M16 21v-7a8 8 0 0 1 16 0v7M24 29v5" /></>}
      {kind === 'shield' && <><path d="M24 5 40 11v13c0 9-8 15-16 19-8-4-16-10-16-19V11Z" /><path d="m17 24 5 5 10-11" /></>}
      {kind === 'chat' && <><path d="M7 10h34v24H23l-9 8v-8H7Z" /><path d="M16 22h.1M24 22h.1M32 22h.1" strokeWidth="4" /></>}
    </svg>
  </span>
}

export function FinalReveal({ reduceMotion, onReveal }: { reduceMotion: boolean; onReveal: () => void }) {
  const [pending, setPending] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const locked = useRef(false)
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current)
  }, [])

  function reveal(): void {
    if (locked.current) return
    locked.current = true
    if (reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onReveal()
      return
    }
    setPending(true)
    timer.current = setTimeout(() => {
      timer.current = null
      onReveal()
    }, 900)
  }

  return <div className="final-reveal">
    <button type="button" className={'primary full-width' + (pending ? ' suspense' : '')} disabled={pending} onClick={reveal}>
      {pending ? 'Revelando…' : 'Revelar impostor'}
    </button>
    {pending && <p className="muted suspense-status" role="status">O mistério está prestes a acabar.</p>}
  </div>
}
