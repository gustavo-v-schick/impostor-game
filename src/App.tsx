import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createRound, getPlayerCard } from './game/round'
import type { Round } from './game/round'

const MIN_PLAYERS = 3
const MAX_NAME_LENGTH = 40

type GameState =
  | { phase: 'setup' }
  | { phase: 'handoff' | 'card'; round: Round; playerIndex: number }
  | { phase: 'playing' | 'result'; round: Round }

export default function App() {
  const [players, setPlayers] = useState<string[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [game, setGame] = useState<GameState>({ phase: 'setup' })
  const [previousWord, setPreviousWord] = useState<string>()

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

  function startRound(): void {
    if (players.length < MIN_PLAYERS) return

    const round = createRound(players, previousWord)
    setPreviousWord(round.entry.word)
    setGame({ phase: 'handoff', round, playerIndex: 0 })
  }

  function revealCard(): void {
    setGame((current) =>
      current.phase === 'handoff' ? { ...current, phase: 'card' } : current,
    )
  }

  function hideCard(): void {
    setGame((current) => {
      if (current.phase !== 'card') return current

      const nextIndex = current.playerIndex + 1
      return nextIndex < current.round.players.length
        ? { phase: 'handoff', round: current.round, playerIndex: nextIndex }
        : { phase: 'playing', round: current.round }
    })
  }

  if (game.phase === 'handoff' || game.phase === 'card') {
    const { round, playerIndex } = game
    const player = round.players[playerIndex]

    return (
      <main className="setup round-screen">
        <header>
          <p className="eyebrow">DISTRIBUIÇÃO</p>
          <p className="muted">Jogador {playerIndex + 1} de {round.players.length}</p>
        </header>

        {game.phase === 'handoff' ? (
          <section key="handoff" className="panel round-panel">
            <p className="muted">Passe o celular para</p>
            <h1 className="player-name">{player}</h1>
            <p className="muted">Só este jogador deve olhar a tela.</p>
            <button type="button" className="primary full-width" onClick={revealCard}>
              Revelar minha informação
            </button>
          </section>
        ) : (
          <section key="card" className="panel round-panel">
            <h2 className="player-name">{player}</h2>
            <SecretCard round={round} playerIndex={playerIndex} />
            <button type="button" className="primary full-width" onClick={hideCard}>
              {playerIndex + 1 === round.players.length ? 'Ocultar e começar' : 'Ocultar e passar'}
            </button>
          </section>
        )}
      </main>
    )
  }

  if (game.phase === 'playing' || game.phase === 'result') {
    const { round } = game
    return (
      <main className="setup round-screen">
        <header><p className="eyebrow">IMPOSTOR</p></header>
        {game.phase === 'playing' ? (
          <section key="playing" className="panel round-panel">
            <h1>Hora de jogar!</h1>
            <p className="muted">Todos receberam suas informações. Discutam as pistas e votem presencialmente.</p>
            <button
              type="button"
              className="primary full-width"
              onClick={() => setGame({ phase: 'result', round })}
            >
              Revelar impostor
            </button>
          </section>
        ) : (
          <section key="result" className="panel round-panel">
            <p className="role-label impostor-role">O impostor era</p>
            <h1 className="player-name">{round.players[round.impostorIndex]}</h1>
            <div className="secret">
              <p className="muted">Palavra secreta</p>
              <p className="secret-value">{round.entry.word}</p>
              <p className="muted">Dica: {round.entry.clue}</p>
            </div>
            <button type="button" className="primary full-width" onClick={startRound}>
              Nova rodada
            </button>
            <button type="button" className="secondary full-width" onClick={() => setGame({ phase: 'setup' })}>
              Alterar jogadores
            </button>
          </section>
        )}
      </main>
    )
  }

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
      <button
        type="button"
        className="primary full-width start-button"
        disabled={missingPlayers > 0}
        onClick={startRound}
      >
        Iniciar rodada
      </button>
    </main>
  )
}

function SecretCard({ round, playerIndex }: { round: Round; playerIndex: number }) {
  const card = getPlayerCard(round, playerIndex)
  const isImpostor = card.role === 'impostor'

  return (
    <div className="secret">
      <p className={`role-label ${isImpostor ? 'impostor-role' : 'civil-role'}`}>
        {isImpostor ? 'Você é o impostor' : 'Você é um civil'}
      </p>
      <p className="muted">{isImpostor ? 'Sua dica' : 'Palavra secreta'}</p>
      <p className="secret-value">{card.role === 'impostor' ? card.clue : card.word}</p>
    </div>
  )
}
