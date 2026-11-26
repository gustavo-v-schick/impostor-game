import { wordKey } from './round'
import type { Round, WordEntry } from './round'

export type Rating = 'good' | 'bad'
export type WordScore = 1 | 2 | 3 | 4 | 5
export interface RatedWord { readonly word: string; readonly score: WordScore }
export interface RatedClue {
  readonly word: string
  readonly clue: string
  readonly rating: Rating
}
export interface Collection {
  readonly wordRatings: readonly RatedWord[]
  readonly blocked: readonly string[]
  readonly ratings: readonly RatedClue[]
  readonly completed: number
  readonly cancelled: number
  readonly roles: readonly { name: string; rounds: number; impostor: number }[]
}

const KEY = 'impostor-game:collection'
export function emptyCollection(): Collection {
  return { wordRatings: [], blocked: [], ratings: [], completed: 0, cancelled: 0, roles: [] }
}

function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function validText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 120
}

function keyList(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter(validText).map(wordKey))] : []
}

export function loadCollection(): Collection {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!value || typeof value !== 'object') return emptyCollection()
    const blocked = keyList(value.blocked)
    const wordRatings: RatedWord[] = []
    if (Array.isArray(value.wordRatings)) {
      for (const item of value.wordRatings) {
        if (!item || !validText(item.word) || !validScore(item.score)) continue
        if (!wordRatings.some(r => wordKey(r.word) === wordKey(item.word))) {
          wordRatings.push({ word: item.word, score: item.score })
        }
      }
    } else {
      // Preserve the old positive marker as a five-star rating.
      for (const word of keyList(value.favorites)) wordRatings.push({ word, score: 5 })
    }
    const ratings: RatedClue[] = []
    if (Array.isArray(value.ratings)) {
      for (const item of value.ratings) {
        if (!item || !validText(item.word) || !validText(item.clue) || (item.rating !== 'good' && item.rating !== 'bad')) continue
        if (!ratings.some(r => wordKey(r.word) === wordKey(item.word) && wordKey(r.clue) === wordKey(item.clue))) {
          ratings.push({ word: item.word, clue: item.clue, rating: item.rating })
        }
      }
    }
    const roles: Collection['roles'][number][] = []
    if (Array.isArray(value.roles)) {
      for (const item of value.roles) {
        if (!item || !validText(item.name) || !validCount(item.rounds) || !validCount(item.impostor) || item.impostor > item.rounds) continue
        if (!roles.some(r => r.name === item.name)) roles.push({ name: item.name, rounds: item.rounds, impostor: item.impostor })
      }
    }
    return { wordRatings, blocked, ratings, roles, completed: validCount(value.completed) ? value.completed : 0, cancelled: validCount(value.cancelled) ? value.cancelled : 0 }
  } catch { return emptyCollection() }
}

export function saveCollection(collection: Collection): void {
  try { localStorage.setItem(KEY, JSON.stringify(collection)) } catch { /* memory fallback */ }
}

function validScore(value: unknown): value is WordScore {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
}

export function getWordScore(collection: Collection, word: string): WordScore | null {
  return collection.wordRatings.find(item => wordKey(item.word) === wordKey(word))?.score ?? null
}

export function rateWord(collection: Collection, word: string, score: WordScore | null): Collection {
  if (score !== null && !validScore(score)) throw new RangeError('Invalid word rating.')
  const wordRatings = collection.wordRatings.filter(item => wordKey(item.word) !== wordKey(word))
  return { ...collection, wordRatings: score === null ? wordRatings : [...wordRatings, { word, score }] }
}

export function toggleBlocked(collection: Collection, word: string): Collection {
  const key = wordKey(word)
  return { ...collection,
    blocked: collection.blocked.includes(key) ? collection.blocked.filter(item => item !== key) : [...collection.blocked, key],
  }
}

export function rateClue(collection: Collection, word: string, clue: string, rating: Rating): Collection {
  const matches = (item: RatedClue) => wordKey(item.word) === wordKey(word) && wordKey(item.clue) === wordKey(clue)
  const previous = collection.ratings.find(matches)
  const ratings = collection.ratings.filter(item => !matches(item))
  return { ...collection, ratings: previous?.rating === rating ? ratings : [...ratings, { word, clue, rating }] }
}

export function filterWords(pool: readonly WordEntry[], collection: Collection): readonly WordEntry[] {
  const blocked = new Set(collection.blocked)
  return pool.filter(entry => !blocked.has(wordKey(entry.word)))
}

export function recordCompleted(collection: Collection, round: Round): Collection {
  const roles = collection.roles.map(item => ({ ...item }))
  round.players.forEach((name, index) => {
    const existing = roles.find(item => item.name === name)
    if (existing) {
      existing.rounds++
      if (index === round.impostorIndex) existing.impostor++
    } else {
      roles.push({ name, rounds: 1, impostor: Number(index === round.impostorIndex) })
    }
  })
  return { ...collection, completed: collection.completed + 1, roles }
}
