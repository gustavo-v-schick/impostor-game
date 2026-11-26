const STORAGE_KEY = 'impostor-game:history'

export interface GameHistory {
  readonly usedWords: readonly string[]
  readonly previousImpostor: string | null
  readonly previousWord: string | null
}

export function loadHistory(): GameHistory {
  const empty: GameHistory = { usedWords: [], previousImpostor: null, previousWord: null }
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (!value || typeof value !== 'object') return empty
    const usedWords: string[] = Array.isArray(value.usedWords)
      ? [...new Set<string>(value.usedWords.filter((item: unknown): item is string => typeof item === 'string' && item.length <= 80))]
      : []
    return { usedWords, previousImpostor: typeof value.previousImpostor === 'string' ? value.previousImpostor : null, previousWord: typeof value.previousWord === 'string' ? value.previousWord : usedWords[usedWords.length - 1] ?? null }
  } catch {
    return empty
  }
}

export function saveHistory(history: GameHistory): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch {
    // Continue in memory if storage is not available.
  }
}
