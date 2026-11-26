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
    <div className="secret discussion-timer">
      <p className="muted">{remaining === 0 ? 'Tempo encerrado' : 'Tempo de discussão'}</p>
      <p className="secret-value" role="timer" aria-label="Tempo restante">{display}</p>
      {remaining === 0 && <p role="status">Hora de votar!</p>}
    </div>
  )
}
