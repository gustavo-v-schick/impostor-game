import catalog from '../data/words.json'

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface WordEntry {
  readonly hints?: Readonly<Record<Difficulty, readonly string[]>>
  readonly category: string
  readonly word: string
  readonly clue: string
}

export interface Round {
  readonly players: readonly string[]
  readonly entry: WordEntry
  readonly impostorIndex: number
  readonly startingPlayerIndex: number
  readonly clueEnabled: boolean
  readonly usedWords: readonly string[]
}

export type PlayerCard =
  | { readonly player: string; readonly role: 'civil'; readonly word: string }
  | { readonly player: string; readonly role: 'impostor'; readonly clue: string | null }

export const words: readonly WordEntry[] = catalog

export const CUSTOM_CATEGORY = 'Personalizadas'

export interface RoundOptions {
  readonly pool: readonly WordEntry[]
  readonly clueEnabled: boolean
  readonly difficulty?: Difficulty
  readonly previousImpostor?: string | null
}

export function getHints(entry: WordEntry, difficulty: Difficulty): readonly string[] {
  return entry.hints?.[difficulty] ?? (difficulty === 'medium' ? [entry.clue] : [])
}

export function wordKey(word: string): string {
  return word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
}

function randomIndex(length: number, random: () => number): number {
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('Random value must be in [0, 1).')
  }
  return Math.floor(value * length)
}

// Draw without replacement until all words have been used in the current cycle.
export function createRound(
  players: readonly string[],
  usedWords: readonly string[] = [],
  options: RoundOptions = { pool: words, clueEnabled: true },
  random: () => number = Math.random,
): Round {
  if (players.length < 3) {
    throw new Error('At least three players are required.')
  }

  const { clueEnabled, difficulty = 'medium', previousImpostor } = options
  const pool = options.pool.filter((entry) => !clueEnabled || getHints(entry, difficulty).length > 0)
  if (pool.length === 0) {
    throw new Error('No words available.')
  }

  const used = new Set(usedWords)
  const unused = pool.filter((entry) => !used.has(wordKey(entry.word)))
  const poolKeys = new Set(pool.map((entry) => wordKey(entry.word)))

  // Reset only the selected pool after exhaustion; keep other categories' history.
  const lastWord = usedWords[usedWords.length - 1]
  const newCycle = pool.filter((entry) => wordKey(entry.word) !== lastWord)
  const candidates = unused.length > 0 ? unused : newCycle.length > 0 ? newCycle : pool
  const selected = candidates[randomIndex(candidates.length, random)]
  const hints = clueEnabled ? getHints(selected, difficulty) : []
  const entry = { ...selected, clue: hints.length ? hints[randomIndex(hints.length, random)] : selected.clue }
  const eligibleImpostors = players.map((_, index) => index).filter((index) =>
    wordKey(players[index]) !== wordKey(previousImpostor ?? ''),
  )
  const impostors = eligibleImpostors.length ? eligibleImpostors : players.map((_, index) => index)
  const history = unused.length > 0 ? usedWords : usedWords.filter((key) => !poolKeys.has(key))

  return {
    players: [...players],
    entry,
    clueEnabled,
    usedWords: [...history, wordKey(entry.word)],
    impostorIndex: impostors[randomIndex(impostors.length, random)],
    startingPlayerIndex: randomIndex(players.length, random),
  }
}

export function getPlayerCard(round: Round, playerIndex: number): PlayerCard {
  if (!Number.isInteger(playerIndex) || playerIndex < 0 || playerIndex >= round.players.length) {
    throw new RangeError('Invalid player index.')
  }

  const player = round.players[playerIndex]
  return playerIndex === round.impostorIndex
    ? { player, role: 'impostor', clue: round.clueEnabled ? round.entry.clue : null }
    : { player, role: 'civil', word: round.entry.word }
}
