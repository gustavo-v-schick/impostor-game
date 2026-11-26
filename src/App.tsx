import { useRef, useState } from 'react'
import type { FormEvent } from 'react'

const MIN_PLAYERS = 3
const MAX_NAME_LENGTH = 40

export default function App() {
  const [players, setPlayers] = useState<string[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function addPlayer(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const playerName = name.trim()

    if (!playerName) {
      setError('Informe o nome do jogador.')
      inputRef.current?.focus()
      return
    }

    if (players.some((player) => player.toLocaleLowerCase('pt-BR') === playerName.toLocaleLowerCase('pt-BR'))) {
      setError('Esse jogador já foi adicionado.')
      inputRef.current?.focus()
      return
    }

    setPlayers((current) => [...current, playerName])
    setName('')
    setError('')
    inputRef.current?.focus()
  }

  function removePlayer(playerName: string): void {
    setPlayers((current) => current.filter((player) => player !== playerName))
    setError('')
  }

  const missingPlayers = Math.max(0, MIN_PLAYERS - players.length)

  return (
    <main className="setup">
      <header>
        <p className="eyebrow">JOGO DE DEDUÇÃO</p>
        <h1>Impostor</h1>
        <p className="muted">Adicione os jogadores para começar.</p>
      </header>

      <section className="panel" aria-labelledby="players-heading">
        <div className="section-heading">
          <h2 id="players-heading">Jogadores</h2>
          <span className="count">{players.length}</span>
        </div>

        <form onSubmit={addPlayer} noValidate>
          <label htmlFor="player-name">Nome do jogador</label>
          <div className="input-row">
            <input
              ref={inputRef}
              id="player-name"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              placeholder="Ex.: Ana"
              autoComplete="off"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'name-error' : undefined}
              onChange={(event) => {
                setName(event.target.value)
                setError('')
              }}
            />
            <button className="primary" type="submit">Adicionar</button>
          </div>
          {error && <p id="name-error" className="error" role="alert">{error}</p>}
        </form>

        {players.length === 0 ? (
          <p className="empty">Nenhum jogador adicionado.</p>
        ) : (
          <ul className="players">
            {players.map((player) => (
              <li key={player}>
                <span>{player}</span>
                <button
                  type="button"
                  className="remove"
                  aria-label={`Remover ${player}`}
                  onClick={() => removePlayer(player)}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="status" aria-live="polite">
          {missingPlayers === 0
            ? 'Quantidade mínima de jogadores atingida.'
            : missingPlayers === 1
              ? 'Adicione mais 1 jogador.'
              : `Adicione mais ${missingPlayers} jogadores.`}
        </p>
      </section>
    </main>
  )
}
