import catalog from '../data/words.json'

export interface WordEntry {
  readonly category: string
  readonly word: string
  readonly clue: string
}

export interface Round {
  readonly players: readonly string[]
  readonly entry: WordEntry
  readonly impostorIndex: number
}

export type PlayerCard =
  | { readonly player: string; readonly role: 'civil'; readonly word: string }
  | { readonly player: string; readonly role: 'impostor'; readonly clue: string }

const words: readonly WordEntry[] = catalog

function randomIndex(length: number, random: () => number): number {
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('Random value must be in [0, 1).')
  }
  return Math.floor(value * length)
}

// Previous word is optional to avoid an immediate repetition between rounds.
export function createRound(
  players: readonly string[],
  previousWord?: string,
  random: () => number = Math.random,
): Round {
  if (players.length < 3) {
    throw new Error('At least three players are required.')
  }

  const candidates = words.filter((entry) => entry.word !== previousWord)
  if (candidates.length === 0) {
    throw new Error('No words available.')
  }

  return {
    players: [...players],
    entry: candidates[randomIndex(candidates.length, random)],
    impostorIndex: randomIndex(players.length, random),
  }
}

export function getPlayerCard(round: Round, playerIndex: number): PlayerCard {
  if (!Number.isInteger(playerIndex) || playerIndex < 0 || playerIndex >= round.players.length) {
    throw new RangeError('Invalid player index.')
  }

  const player = round.players[playerIndex]
  return playerIndex === round.impostorIndex
    ? { player, role: 'impostor', clue: round.entry.clue }
    : { player, role: 'civil', word: round.entry.word }
}
