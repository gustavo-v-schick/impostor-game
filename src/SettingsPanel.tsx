import { useState } from 'react'
import type { FormEvent } from 'react'
import { CUSTOM_CATEGORY, wordKey, words, getHints, matchesWordDifficulty } from './game/round'
import type { WordEntry, Difficulty } from './game/round'
import { filterWords } from './game/collection'
import type { Collection } from './game/collection'

export type Theme = 'violet' | 'ocean' | 'forest' | 'amber'

export interface GameSettings {
  readonly categories: readonly string[]
  readonly difficulty: Difficulty
  readonly wordDifficulty: Difficulty | 'all'
  readonly avoidSimilar: boolean
  readonly timerSeconds: number
  readonly holdToReveal: boolean
  readonly clueEnabled: boolean
  readonly customWords: readonly WordEntry[]
  readonly theme: Theme
  readonly sound: boolean
  readonly haptics: boolean
  readonly reduceMotion: boolean
  readonly largeText: boolean
  readonly highContrast: boolean
}

const STORAGE_KEY = 'impostor-game:settings'
const TIMER_OPTIONS = [0, 60, 120, 180, 300] as const
const categories = [...new Set(words.map((entry) => entry.category))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

export function loadSettings(): GameSettings {
  const defaults: GameSettings = { categories: [], difficulty: 'medium', wordDifficulty: 'all', avoidSimilar: true, timerSeconds: 0, holdToReveal: true, clueEnabled: true, customWords: [], theme: 'violet', sound: false, haptics: false, reduceMotion: false, largeText: false, highContrast: false }
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (!stored || typeof stored !== 'object') return defaults
    const seen = new Set(words.map((entry) => wordKey(entry.word)))
    const customWords: WordEntry[] = []
    if (Array.isArray(stored.customWords)) {
      for (const entry of stored.customWords) {
        if (!entry || typeof entry.word !== 'string' || typeof entry.clue !== 'string') continue
        const word = entry.word.trim()
        const clue = entry.clue.trim()
        const key = wordKey(word)
        if (!word || !clue || word.length > 80 || clue.length > 80 || key === wordKey(clue) || seen.has(key)) continue
        seen.add(key)
        customWords.push({ category: CUSTOM_CATEGORY, word, clue })
      }
    }
    const validCategories = [...categories, ...(customWords.length ? [CUSTOM_CATEGORY] : [])]
    const savedCategories: unknown[] = Array.isArray(stored.categories) ? stored.categories : [stored.category]
    const selectedCategories = [...new Set(savedCategories.filter((value): value is string => typeof value === 'string' && validCategories.includes(value)))]
    return {
      categories: selectedCategories,
      difficulty: stored.difficulty === 'easy' || stored.difficulty === 'hard' ? stored.difficulty : 'medium',
      wordDifficulty: stored.wordDifficulty === 'easy' || stored.wordDifficulty === 'medium' || stored.wordDifficulty === 'hard' ? stored.wordDifficulty : 'all',
      avoidSimilar: typeof stored.avoidSimilar === 'boolean' ? stored.avoidSimilar : true,
      timerSeconds: TIMER_OPTIONS.some((seconds) => seconds === stored.timerSeconds) ? stored.timerSeconds : 0,
      holdToReveal: typeof stored.holdToReveal === 'boolean' ? stored.holdToReveal : true,
      clueEnabled: typeof stored.clueEnabled === 'boolean' ? stored.clueEnabled : true,
      customWords,
      theme: stored.theme === 'ocean' || stored.theme === 'forest' || stored.theme === 'amber' ? stored.theme : 'violet',
      sound: stored.sound === true,
      haptics: stored.haptics === true,
      reduceMotion: stored.reduceMotion === true,
      largeText: stored.largeText === true,
      highContrast: stored.highContrast === true,
    }
  } catch {
    return defaults
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Settings remain usable for the current session.
  }
}

export function getWordPool(settings: GameSettings, collection: Collection): readonly WordEntry[] {
  const entries = [...words, ...settings.customWords]
  return filterWords(entries, collection).filter((entry) =>
    (settings.categories.length === 0 || settings.categories.includes(entry.category)) &&
    matchesWordDifficulty(entry, settings.wordDifficulty) &&
    (!settings.clueEnabled || getHints(entry, settings.difficulty).length > 0),
  )
}

interface Props {
  settings: GameSettings
  collection: Collection
  onChange: (settings: GameSettings) => void
}

export default function SettingsPanel({ settings, collection, onChange }: Props) {
  const [word, setWord] = useState('')
  const [clue, setClue] = useState('')
  const [error, setError] = useState('')

  function addWord(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const newWord = word.trim()
    const newClue = clue.trim()
    if (!newWord || !newClue) {
      setError('Preencha a palavra e a dica.')
      return
    }
    if (wordKey(newWord) === wordKey(newClue)) {
      setError('A dica deve ser diferente da palavra.')
      return
    }
    if ([...words, ...settings.customWords].some((entry) => wordKey(entry.word) === wordKey(newWord))) {
      setError('Essa palavra já está no catálogo.')
      return
    }
    onChange({ ...settings, customWords: [...settings.customWords, { category: CUSTOM_CATEGORY, word: newWord, clue: newClue }] })
    setWord('')
    setClue('')
    setError('')
  }

  function removeWord(entry: WordEntry): void {
    const customWords = settings.customWords.filter((item) => wordKey(item.word) !== wordKey(entry.word))
    onChange({
      ...settings,
      customWords,
      categories: customWords.length ? settings.categories : settings.categories.filter((category) => category !== CUSTOM_CATEGORY),
    })
  }

  return (
    <details className="panel settings-panel">
      <summary>Opções da rodada <span className="muted">· {getWordPool(settings, collection).length} palavras</span></summary>
      <div className="settings-content">
        <details className="category-panel">
          <summary>Categorias · {settings.categories.length === 0 ? 'Todas' : settings.categories.length + ' selecionadas'}</summary>
          <button type="button" className="secondary full-width" onClick={() => onChange({ ...settings, categories: [] })}>Usar todas</button>
          <p className="muted category-help">Sem seleção específica, todas entram no sorteio.</p>
          <div className="category-options">
            {[...categories, ...(settings.customWords.length ? [CUSTOM_CATEGORY] : [])].map((category) => (
              <label className="check-option" key={category}>
                <input type="checkbox" checked={settings.categories.includes(category)} onChange={(event) => onChange({
                  ...settings,
                  categories: event.target.checked ? [...settings.categories, category] : settings.categories.filter((item) => item !== category),
                })} />
                {category}
              </label>
            ))}
          </div>
        </details>
        <label className="check-option">
          <input type="checkbox" checked={settings.clueEnabled} onChange={(event) => onChange({ ...settings, clueEnabled: event.target.checked })} />
          Impostor recebe dica
        </label>
        <label htmlFor="word-difficulty">Dificuldade da palavra</label>
        <select id="word-difficulty" value={settings.wordDifficulty} onChange={event => onChange({ ...settings, wordDifficulty: event.target.value as Difficulty | 'all' })}>
          <option value="all">Todas</option>
          <option value="easy">Fácil — palavras familiares</option>
          <option value="medium">Normal — dificuldade intermediária ou não revisada</option>
          <option value="hard">Difícil — termos mais específicos</option>
        </select>
        <p className="muted category-help">A classificação é editorial e provisória; não depende das notas dos jogadores.</p>
        <label className="check-option">
          <input type="checkbox" checked={settings.avoidSimilar} onChange={event => onChange({ ...settings, avoidSimilar: event.target.checked })} />
          Evitar palavras semelhantes em rodadas seguidas
        </label>
        <label htmlFor="difficulty">Dificuldade da dica</label>
        <select id="difficulty" disabled={!settings.clueEnabled} value={settings.difficulty} onChange={(event) => onChange({ ...settings, difficulty: event.target.value as Difficulty })}>
          <option value="easy">Fácil — dicas mais diretas</option>
          <option value="medium">Normal — dicas equilibradas</option>
          <option value="hard">Difícil — dicas indiretas</option>
        </select>
        <p className="muted category-help">Todas as palavras do catálogo têm dicas nos três níveis. Palavras personalizadas entram no modo normal ou sem dica.</p>
        <label htmlFor="timer">Tempo de discussão</label>
        <select id="timer" value={settings.timerSeconds} onChange={(event) => onChange({ ...settings, timerSeconds: Number(event.target.value) })}>
          {TIMER_OPTIONS.map((seconds) => <option key={seconds} value={seconds}>{seconds ? seconds / 60 + ' min' : 'Sem cronômetro'}</option>)}
        </select>
        <label className="check-option">
          <input type="checkbox" checked={settings.holdToReveal} onChange={(event) => onChange({ ...settings, holdToReveal: event.target.checked })} />
          Segurar para revelar
        </label>
        {getWordPool(settings, collection).length === 0 && <p className="error" role="alert">Nenhuma palavra disponível com estas opções.</p>}
        <fieldset className="appearance">
          <legend>Aparência e acessibilidade</legend>
          <div className="theme-options" role="group" aria-label="Tema visual">
            {([{ id: 'violet', name: 'Violeta' }, { id: 'ocean', name: 'Oceano' }, { id: 'forest', name: 'Floresta' }, { id: 'amber', name: 'Âmbar' }] as const).map(theme =>
              <button type="button" className="theme-option" key={theme.id} data-swatch={theme.id} aria-pressed={settings.theme === theme.id} onClick={() => onChange({ ...settings, theme: theme.id })}>
                <span className="theme-swatch" aria-hidden="true" />{theme.name}
              </button>
            )}
          </div>
          <label className="check-option"><input type="checkbox" checked={settings.largeText} onChange={event => onChange({ ...settings, largeText: event.target.checked })} />Texto ampliado</label>
          <label className="check-option"><input type="checkbox" checked={settings.highContrast} onChange={event => onChange({ ...settings, highContrast: event.target.checked })} />Contraste reforçado</label>
          <label className="check-option"><input type="checkbox" checked={settings.reduceMotion} onChange={event => onChange({ ...settings, reduceMotion: event.target.checked })} />Reduzir animações</label>
        </fieldset>
        <label className="check-option">
          <input type="checkbox" checked={settings.sound} onChange={event => onChange({ ...settings, sound: event.target.checked })} />
          Efeitos sonoros
        </label>
        <label className="check-option">
          <input type="checkbox" checked={settings.haptics} onChange={event => onChange({ ...settings, haptics: event.target.checked })} />
          Vibração nas transições (se compatível)
        </label>
        <details className="custom-panel">
          <summary>Palavras personalizadas ({settings.customWords.length})</summary>
          <p className="muted">Adicione referências do seu grupo antes da partida. Elas entram no sorteio de todas as categorias ou em Personalizadas.</p>
          <form onSubmit={addWord} noValidate>
            <label htmlFor="custom-word">Palavra secreta</label>
            <input id="custom-word" value={word} onChange={(event) => setWord(event.target.value)} maxLength={80} autoComplete="off" />
            <label htmlFor="custom-clue">Dica</label>
            <input id="custom-clue" value={clue} onChange={(event) => setClue(event.target.value)} maxLength={80} autoComplete="off" />
            {error && <p className="error" role="alert">{error}</p>}
            <button type="submit" className="secondary full-width">Adicionar palavra</button>
          </form>
          <ul className="players">
            {settings.customWords.map((entry) => (
              <li key={wordKey(entry.word)}>
                <span>{entry.word}<small className="muted"> · {entry.clue}</small></span>
                <button type="button" className="remove" aria-label={`Remover ${entry.word}`} onClick={() => removeWord(entry)}>Remover</button>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </details>
  )
}
