import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createRound, getPlayerCard, wordKey } from './game/round'
import type { Round } from './game/round'
import { version } from '../package.json'
import { watchForUpdate, applyUpdate } from './pwa'
import SettingsPanel, { loadSettings, saveSettings, getWordPool } from './SettingsPanel'
import { loadHistory, saveHistory } from './game/history'
import { RevealButton, DiscussionTimer } from './RoundControls'
import { loadCollection, saveCollection, recordCompleted } from './game/collection'
import { CollectionPanel, RoundFeedback, StatsPanel } from './CollectionPanel'
import { playSound } from './sound'

const MIN_PLAYERS = 3
const MAX_NAME_LENGTH = 40
const PLAYERS_STORAGE_KEY = 'impostor-game:players'

function loadPlayers(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(PLAYERS_STORAGE_KEY) ?? '[]')
    if (!Array.isArray(stored)) return []

    const players: string[] = []
    const names = new Set<string>()
    for (const value of stored) {
      if (typeof value !== 'string') continue
      const name = value.trim()
      const key = name.toLocaleLowerCase('pt-BR')
      if (!name || name.length > MAX_NAME_LENGTH || names.has(key)) continue
      names.add(key)
      players.push(name)
    }
    return players
  } catch {
    return []
  }
}

type GameState =
  | { phase: 'setup' }
  | { phase: 'handoff' | 'card'; round: Round; playerIndex: number }
  | { phase: 'playing' | 'result'; round: Round }

export default function App() {
  const [players, setPlayers] = useState<string[]>(loadPlayers)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [game, setGame] = useState<GameState>({ phase: 'setup' })
  const [history, setHistory] = useState(loadHistory)
  useEffect(() => saveHistory(history), [history])
  const [collection, setCollection] = useState(loadCollection)
  useEffect(() => saveCollection(collection), [collection])
  const [settings, setSettings] = useState(loadSettings)
  useEffect(() => { document.documentElement.dataset.theme = settings.theme }, [settings.theme])
  useEffect(() => saveSettings(settings), [settings])
  const [updateWorker, setUpdateWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => watchForUpdate(setUpdateWorker), [])

  useEffect(() => {
    try {
      localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(players))
    } catch {
      // The game remains playable when browser storage is unavailable.
    }
  }, [players])

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

  function movePlayer(index: number, direction: -1 | 1): void {
    setPlayers(current => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const missingPlayers = Math.max(0, MIN_PLAYERS - players.length)
  const pool = getWordPool(settings, collection)

  function startRound(): void {
    if (players.length < MIN_PLAYERS) return

    if (!pool.length) return
    const round = createRound(players, history.usedWords, {
      pool,
      clueEnabled: settings.clueEnabled,
      difficulty: settings.difficulty,
      previousImpostor: history.previousImpostor,
      previousWord: history.previousWord,
      wordDifficulty: settings.wordDifficulty,
      avoidSimilar: settings.avoidSimilar,
    })
    setHistory({ usedWords: round.usedWords, previousWord: wordKey(round.entry.word), previousImpostor: wordKey(round.players[round.impostorIndex]) })
    playSound(settings.sound, 'start')
    setGame({ phase: 'handoff', round, playerIndex: 0 })
  }

  function cancelRound(): void {
    if (window.confirm('Cancelar esta rodada e voltar aos jogadores?')) {
      setCollection(current => ({ ...current, cancelled: current.cancelled + 1 }))
      setGame({ phase: 'setup' })
    }
  }

  function revealCard(): void {
    setGame((current) =>
      current.phase === 'handoff' ? { ...current, phase: 'card' } : current,
    )
  }

  function hideCard(): void {
    playSound(settings.sound, 'next')
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
        <header className="distribution-header">
          <p className="eyebrow">DISTRIBUIÇÃO</p>
          <p className="muted">Jogador {playerIndex + 1} de {round.players.length}</p>
          <progress className="progress" value={playerIndex + (game.phase === 'card' ? 1 : 0)} max={round.players.length} aria-label="Progresso da distribuição" />
        </header>

        {game.phase === 'handoff' ? (
          <section key="handoff" className="panel round-panel">
            <p className="muted">Passe o celular para</p>
            <h1 className="player-name">{player}</h1>
            <p className="muted">Só este jogador deve olhar a tela.</p>
            <RevealButton hold={settings.holdToReveal} onReveal={revealCard} />
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
        <button type="button" className="secondary cancel-round" onClick={cancelRound}>Cancelar rodada</button>
        <VersionFooter />
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
            <p className="muted">Todos receberam suas informações.</p>
            <div className="secret">
              <p className="muted">Quem começa a falar</p>
              <p className="secret-value">{round.players[round.startingPlayerIndex]}</p>
            </div>
            <p className="muted">Discutam as pistas e votem presencialmente.</p>
            {settings.timerSeconds > 0 && <DiscussionTimer seconds={settings.timerSeconds} />}
            <button
              type="button"
              className="primary full-width"
              onClick={() => {
                setCollection(current => recordCompleted(current, round))
                playSound(settings.sound, 'end')
                setGame({ phase: 'result', round })
              }}
            >
              Revelar impostor
            </button>
            <button type="button" className="secondary full-width" onClick={cancelRound}>Cancelar rodada</button>
          </section>
        ) : (
          <section key="result" className="panel round-panel">
            <p className="role-label impostor-role">O impostor era</p>
            <h1 className="player-name">{round.players[round.impostorIndex]}</h1>
            <div className="secret">
              <p className="muted">Palavra secreta</p>
              <p className="secret-value">{round.entry.word}</p>
              <p className="muted">{round.clueEnabled ? `Dica: ${round.entry.clue}` : 'Rodada sem dica'}</p>
            </div>
            <RoundFeedback round={round} collection={collection} onChange={setCollection} />
            <button type="button" className="primary full-width" disabled={pool.length === 0} onClick={startRound}>
              Nova rodada
            </button>
            {pool.length === 0 && <p className="error">Nenhuma palavra disponível. Altere as opções para continuar.</p>}
            <button type="button" className="secondary full-width" onClick={() => setGame({ phase: 'setup' })}>
              Alterar jogadores
            </button>
          </section>
        )}
        <VersionFooter />
      </main>
    )
  }

  return (
    <main className="setup">
      <header>
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width="60" height="60" />
          <div>
            <p className="eyebrow">JOGO DE DEDUÇÃO</p>
            <h1>Impostor<span className="brand-dot">.</span></h1>
          </div>
        </div>
        <p className="muted">Adicione os jogadores para começar.</p>
      </header>

      {updateWorker && (
        <div className="update-notice">
          <span>Nova versão disponível.</span>
          <button className="secondary" type="button" onClick={() => applyUpdate(updateWorker)}>Atualizar</button>
        </div>
      )}
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
            {players.map((player, index) => (
              <li key={player}>
                <span>{player}</span>
                <div className="player-actions">
                  <button type="button" className="secondary compact" disabled={index === 0} aria-label={'Mover ' + player + ' para cima'} onClick={() => movePlayer(index, -1)}>↑</button>
                  <button type="button" className="secondary compact" disabled={index === players.length - 1} aria-label={'Mover ' + player + ' para baixo'} onClick={() => movePlayer(index, 1)}>↓</button>
                <button
                  type="button"
                  className="remove"
                  aria-label={`Remover ${player}`}
                  onClick={() => removePlayer(player)}
                >
                  Remover
                </button>
                </div>
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
      <SettingsPanel settings={settings} collection={collection} onChange={setSettings} />
      <CollectionPanel collection={collection} customWords={settings.customWords} onChange={setCollection} />
      <StatsPanel collection={collection} onChange={setCollection} />
      <button
        type="button"
        className="primary full-width start-button"
        disabled={missingPlayers > 0 || pool.length === 0}
        onClick={startRound}
      >
        Iniciar rodada
      </button>
      <VersionFooter />
    </main>
  )
}

function SecretCard({ round, playerIndex }: { round: Round; playerIndex: number }) {
  const card = getPlayerCard(round, playerIndex)
  const isImpostor = card.role === 'impostor'

  return (
    <div className={`secret role-card ${isImpostor ? 'role-impostor' : 'role-civil'}`}>
      <p className={`role-label ${isImpostor ? 'impostor-role' : 'civil-role'}`}>
        {isImpostor ? 'Você é o impostor' : 'Você é um civil'}
      </p>
      {card.role === 'impostor' && card.clue === null ? (
        <p className="muted">Nesta rodada, você não recebe dica.</p>
      ) : (
        <>
          <p className="muted">{isImpostor ? 'Sua dica' : 'Palavra secreta'}</p>
          <p className="secret-value">{card.role === 'impostor' ? card.clue : card.word}</p>
        </>
      )}
    </div>
  )
}

function VersionFooter() {
  return <footer className="version-footer">IMPOSTOR GAME · v{version}</footer>
}
