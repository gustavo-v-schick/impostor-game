import { useState } from 'react'
import type { FormEvent } from 'react'
import { CUSTOM_CATEGORY, wordKey, words } from './game/round'
import type { WordEntry } from './game/round'

export interface GameSettings {
  readonly category: string
  readonly clueEnabled: boolean
  readonly customWords: readonly WordEntry[]
}

const STORAGE_KEY = 'impostor-game:settings'
export const ALL_CATEGORIES = 'Todas'
const categories = [...new Set(words.map((entry) => entry.category))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

export function loadSettings(): GameSettings {
  const defaults = { category: ALL_CATEGORIES, clueEnabled: true, customWords: [] }
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
    const validCategories = [ALL_CATEGORIES, ...categories, ...(customWords.length ? [CUSTOM_CATEGORY] : [])]
    return {
      category: validCategories.includes(stored.category) ? stored.category : ALL_CATEGORIES,
      clueEnabled: typeof stored.clueEnabled === 'boolean' ? stored.clueEnabled : true,
      customWords,
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

export function getWordPool(settings: GameSettings): readonly WordEntry[] {
  const entries = [...words, ...settings.customWords]
  return settings.category === ALL_CATEGORIES ? entries : entries.filter((entry) => entry.category === settings.category)
}

interface Props {
  settings: GameSettings
  onChange: (settings: GameSettings) => void
}

export default function SettingsPanel({ settings, onChange }: Props) {
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
      category: settings.category === CUSTOM_CATEGORY && !customWords.length ? ALL_CATEGORIES : settings.category,
    })
  }

  return (
    <details className="panel settings-panel">
      <summary>Opções da rodada <span className="muted">· {getWordPool(settings).length} palavras</span></summary>
      <div className="settings-content">
        <label htmlFor="category">Categoria</label>
        <select id="category" value={settings.category} onChange={(event) => onChange({ ...settings, category: event.target.value })}>
          <option value={ALL_CATEGORIES}>Todas as categorias</option>
          {categories.map((category) => <option key={category}>{category}</option>)}
          {settings.customWords.length > 0 && <option>{CUSTOM_CATEGORY}</option>}
        </select>
        <label className="check-option">
          <input type="checkbox" checked={settings.clueEnabled} onChange={(event) => onChange({ ...settings, clueEnabled: event.target.checked })} />
          Impostor recebe dica
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
