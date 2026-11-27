import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createRound, getPlayerCard, wordKey } from './game/round'
import type { Round } from './game/round'
import { version } from '../package.json'
import { watchForUpdate, applyUpdate } from './pwa'
import SettingsPanel, { CategoriesPanel, loadSettings, saveSettings, getWordPool } from './SettingsPanel'
import { loadHistory, saveHistory } from './game/history'
import { RevealButton, DiscussionTimer, FinalReveal, GameMark } from './RoundControls'
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
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [showWords, setShowWords] = useState(false)
  const [showStats, setShowStats] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.theme
    root.dataset.motion = settings.reduceMotion ? 'reduced' : 'auto'
    root.dataset.text = settings.largeText ? 'large' : 'normal'
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal'
    const colors = { violet: '#11131e', ocean: '#101d2a', forest: '#111e19', amber: '#211a15' }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.highContrast ? '#090a10' : colors[settings.theme])
  }, [settings.theme, settings.reduceMotion, settings.largeText, settings.highContrast])
  const screenRef = useRef<HTMLElement>(null)
  const screenIdentity = game.phase === 'handoff' || game.phase === 'card' ? game.phase + ':' + game.playerIndex : game.phase
  useEffect(() => {
    screenRef.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [screenIdentity])

  function vibrate(): void {
    if (settings.haptics && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(20) } catch { /* Optional on supported devices. */ }
    }
  }
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
    vibrate()
    setGame({ phase: 'handoff', round, playerIndex: 0 })
  }

  function cancelRound(): void {
    if (window.confirm('Cancelar esta rodada e voltar aos jogadores?')) {
      setCollection(current => ({ ...current, cancelled: current.cancelled + 1 }))
      setGame({ phase: 'setup' })
    }
  }

  function revealCard(): void {
    vibrate()
    setGame((current) =>
      current.phase === 'handoff' ? { ...current, phase: 'card' } : current,
    )
  }

  function hideCard(): void {
    playSound(settings.sound, 'next')
    vibrate()
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
      <main ref={screenRef} tabIndex={-1} className="setup round-screen">
        <header className="distribution-header">
          <div className="round-topline"><span className="eyebrow">01 / DISTRIBUIÇÃO</span><span className="step-count">{playerIndex + 1} / {round.players.length}</span></div>
          <progress className="progress" value={playerIndex + (game.phase === 'card' ? 1 : 0)} max={round.players.length} aria-label="Progresso da distribuição" />
        </header>

        {game.phase === 'handoff' ? (
          <section key="handoff" className="panel round-panel handoff-panel">
            <GameMark kind="lock" />
            <p className="eyebrow">PASSE O CELULAR PARA</p>
            <h1 className="player-name">{player}</h1>
            <p className="muted">Só este jogador deve olhar a tela.</p>
            <div className="sealed-card" aria-hidden="true"><GameMark kind="eye" /><span>INFORMAÇÃO SECRETA</span></div>
            <RevealButton hold={settings.holdToReveal} onReveal={revealCard} />
          </section>
        ) : (
          <section key="card" className="panel round-panel private-panel">
            <p className="eyebrow">SUA IDENTIDADE</p>
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
      <main ref={screenRef} tabIndex={-1} className="setup round-screen">
        <header className="round-topline"><span className="eyebrow">{game.phase === 'playing' ? '02 / DISCUSSÃO' : '03 / REVELAÇÃO'}</span><span className="wordmark">IMPOSTOR.</span></header>
        {game.phase === 'playing' ? (
          <section key="playing" className="panel round-panel playing-panel">
            <GameMark kind="chat" />
            <h1>Hora de jogar!</h1>
            <p className="muted">Todos receberam suas informações.</p>
            <div className="secret">
              <p className="muted">Quem começa a falar</p>
              <p className="secret-value">{round.players[round.startingPlayerIndex]}</p>
            </div>
            <p className="muted">Discutam as pistas e votem presencialmente.</p>
            {settings.timerSeconds > 0 && <DiscussionTimer seconds={settings.timerSeconds} />}
            <FinalReveal reduceMotion={settings.reduceMotion} onReveal={() => {
              setCollection(current => recordCompleted(current, round))
              playSound(settings.sound, 'end')
              vibrate()
              setGame({ phase: 'result', round })
            }} />
            <button type="button" className="secondary full-width" onClick={cancelRound}>Cancelar rodada</button>
          </section>
        ) : (
          <section key="result" className="panel round-panel result-panel">
            <div className="result-hero">
              <GameMark kind="eye" />
              <p className="role-label impostor-role">O IMPOSTOR ERA</p>
              <h1 className="player-name">{round.players[round.impostorIndex]}</h1>
            </div>
            <div className="secret">
              <p className="muted">Palavra secreta</p>
              <p className="secret-value">{round.entry.word}</p>
              <p className="muted">{round.clueEnabled ? `Dica: ${round.entry.clue}` : 'Rodada sem dica'}</p>
            </div>
            <details className="feedback-drawer"><summary>Avaliar palavra e dica</summary><RoundFeedback round={round} collection={collection} onChange={setCollection} /></details>
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
    <main ref={screenRef} tabIndex={-1} className="setup setup-home">
      <header className="home-hero">
        <div className="brand">
          <GameMark kind="eye" />
          <div>
            <p className="eyebrow">DEDUÇÃO SOCIAL</p>
            <h1>Impostor<span className="brand-dot">.</span></h1>
          </div>
        </div>
        <p className="hero-tagline">Uma palavra. Um infiltrado.</p>
        <p className="muted">Descubra quem está blefando.</p>
        <div className="hero-meta"><span>3+ jogadores</span><span>Um celular</span><span>Offline após carregar</span></div>
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
                <span className="player-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span className="player-list-name">{player}</span>
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
      <CategoriesPanel settings={settings} onChange={setSettings} />
      <SettingsPanel settings={settings} collection={collection} onChange={setSettings} />
      <button type="button" className="secondary full-width advanced-toggle" aria-expanded={advancedOpen} aria-controls="advanced-options" onClick={() => setAdvancedOpen(current => !current)}>
        <span>Opções avançadas</span><span aria-hidden="true">{advancedOpen ? '−' : '+'}</span>
      </button>
      <section id="advanced-options" hidden={!advancedOpen} aria-label="Opções avançadas">
        {advancedOpen && <>
          <div className="panel settings-panel advanced-selection">
            <label className="check-option">
              <input type="checkbox" checked={showWords} onChange={event => setShowWords(event.target.checked)} />
              Gerenciar palavras
            </label>
            <label className="check-option">
              <input type="checkbox" checked={showStats} onChange={event => setShowStats(event.target.checked)} />
              Estatísticas locais
            </label>
          </div>
          {showWords && <CollectionPanel collection={collection} customWords={settings.customWords} onChange={setCollection} />}
          {showStats && <StatsPanel collection={collection} onChange={setCollection} />}
        </>}
      </section>
      <div className="start-dock">
        <div className="dock-meta"><span>{players.length} jogadores</span><span>{pool.length} palavras elegíveis</span></div>
        <button type="button" className="primary full-width start-button" disabled={missingPlayers > 0 || pool.length === 0} onClick={startRound}>
          Iniciar rodada <span aria-hidden="true">→</span>
        </button>
        <VersionFooter />
      </div>
    </main>
  )
}

function SecretCard({ round, playerIndex }: { round: Round; playerIndex: number }) {
  const card = getPlayerCard(round, playerIndex)
  const isImpostor = card.role === 'impostor'

  return (
    <div className={`secret role-card ${isImpostor ? 'role-impostor' : 'role-civil'}`}>
      <GameMark kind={isImpostor ? 'eye' : 'shield'} />
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
