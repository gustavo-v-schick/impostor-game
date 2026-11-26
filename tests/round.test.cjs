const test = require('node:test')
const assert = require('node:assert/strict')
const { createRound, getPlayerCard, getHints, wordKey, words } = require('../.test-build/game/round.js')

const players = ['Ana', 'Bruno', 'Caio', 'Dani']
const pool = [
  { category: 'Teste', word: 'Pinguim', clue: 'Frio', hints: { easy: ['Antártida'], medium: ['Frio', 'Colônia'], hard: ['Marcha'] } },
  { category: 'Teste', word: 'Xadrez', clue: 'Estratégia', hints: { easy: ['Tabuleiro'], medium: ['Estratégia'], hard: ['Sacrifício'] } },
  { category: 'Teste', word: 'Espelho', clue: 'Reflexo', hints: { easy: ['Vidro'], medium: ['Reflexo'], hard: ['Simetria'] } },
]
const options = { pool, clueEnabled: true }
const first = () => 0

test('catalog: 2,000+ unique words, valid clues in all three difficulties', () => {
  assert.ok(words.length >= 2000)
  const seen = new Set()
  for (const entry of words) {
    const key = wordKey(entry.word)
    assert.ok(key && entry.category.trim() && entry.clue.trim())
    assert.ok(!seen.has(key), 'Duplicate word: ' + entry.word)
    seen.add(key)
    const hints = []
    for (const difficulty of ['easy', 'medium', 'hard']) {
      const group = getHints(entry, difficulty)
      assert.ok(group.length > 0, entry.word + ': ' + difficulty)
      for (const hint of group) {
        assert.ok(hint.trim() && wordKey(hint) !== key, entry.word + ': ' + hint)
        hints.push(wordKey(hint))
      }
    }
    assert.equal(new Set(hints).size, hints.length, 'Repeated clue: ' + entry.word)
    assert.ok(getHints(entry, 'medium').includes(entry.clue))
  }
})

test('normalization ignores case and accents', () => {
  assert.equal(wordKey('  AÇÚCAR '), 'acucar')
})

test('round has exactly one impostor and all civilians see the same word', () => {
  const round = createRound(players, [], options, first)
  const cards = players.map((_, i) => getPlayerCard(round, i))
  assert.equal(cards.filter(card => card.role === 'impostor').length, 1)
  for (const card of cards) {
    if (card.role === 'impostor') {
      assert.equal(card.clue, round.entry.clue)
      assert.ok(!('word' in card))
    } else {
      assert.equal(card.word, round.entry.word)
      assert.ok(!('clue' in card))
    }
  }
  assert.ok(round.startingPlayerIndex >= 0 && round.startingPlayerIndex < players.length)
  assert.notEqual(round.players, players)
})

test('chosen difficulty supplies only the corresponding clues', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const round = createRound(players, [], { ...options, difficulty }, first)
    assert.ok(getHints(pool[0], difficulty).includes(round.entry.clue))
  }
  const random = (() => {
    const values = [0, 0.99, 0, 0]
    return () => values.shift()
  })()
  assert.equal(createRound(players, [], options, random).entry.clue, 'Colônia')
})

test('disabled clue is not revealed, even with a hard difficulty and a custom word', () => {
  const round = createRound(players, [], { pool: [{ category: 'Personalizadas', word: 'Festa', clue: 'Encontro' }], clueEnabled: false, difficulty: 'hard' }, first)
  assert.equal(getPlayerCard(round, round.impostorIndex).clue, null)
})

test('words do not repeat before the selected pool is exhausted', () => {
  let used = []
  const drawn = []
  for (let i = 0; i < pool.length; i++) {
    const round = createRound(players, used, options, first)
    drawn.push(round.entry.word)
    used = round.usedWords
  }
  assert.equal(new Set(drawn).size, pool.length)
  const next = createRound(players, used, options, first)
  assert.notEqual(next.entry.word, drawn.at(-1))
  assert.equal(next.usedWords.length, 1)
})

test('selected pool exhaustion preserves history from other categories', () => {
  const used = ['outro', 'pinguim', 'xadrez', 'espelho']
  const round = createRound(players, used, options, first)
  assert.ok(round.usedWords.includes('outro'))
  assert.equal(round.usedWords.length, 2)
})

test('previous impostor is excluded when other players are available', () => {
  const round = createRound(players, [], { ...options, previousImpostor: 'ANA' }, first)
  assert.notEqual(round.players[round.impostorIndex], 'Ana')
})

test('invalid players, empty pools, invalid indices and random values are rejected', () => {
  assert.throws(() => createRound(['Ana', 'Bruno'], [], options, first))
  assert.throws(() => createRound(players, [], { ...options, pool: [] }, first))
  assert.throws(() => createRound(players, [], options, () => 1), RangeError)
  const round = createRound(players, [], options, first)
  assert.throws(() => getPlayerCard(round, -1), RangeError)
  assert.throws(() => getPlayerCard(round, 1.5), RangeError)
})

const { emptyCollection, toggleFavorite, toggleBlocked, rateClue, filterWords, recordCompleted } = require('../.test-build/game/collection.js')

test('favorites have double weight but cannot bypass no-repeat history', () => {
  const round = createRound(players, [], { ...options, favoriteWords: ['pinguim'] }, () => 0.99)
  assert.equal(round.entry.word, 'Pinguim')
  const next = createRound(players, ['pinguim'], { ...options, favoriteWords: ['pinguim'] }, () => 0.99)
  assert.notEqual(next.entry.word, 'Pinguim')
})

test('blocking excludes words and removes favorite status; unblocking restores availability', () => {
  let collection = toggleFavorite(emptyCollection(), 'Pinguim')
  collection = toggleBlocked(collection, 'PINGUIM')
  assert.deepEqual(collection.favorites, [])
  assert.equal(filterWords(pool, collection).length, 2)
  collection = toggleBlocked(collection, 'pinguim')
  assert.equal(filterWords(pool, collection).length, 3)
})

test('rating replaces previous vote and can be cleared', () => {
  let collection = rateClue(emptyCollection(), 'Pinguim', 'Frio', 'good')
  collection = rateClue(collection, 'pinguim', 'frio', 'bad')
  assert.equal(collection.ratings.length, 1)
  assert.equal(collection.ratings[0].rating, 'bad')
  collection = rateClue(collection, 'Pinguim', 'Frio', 'bad')
  assert.equal(collection.ratings.length, 0)
})

test('completed rounds record participation and exactly one impostor', () => {
  const round = createRound(players, [], options, first)
  const initial = emptyCollection()
  const collection = recordCompleted(initial, round)
  assert.equal(initial.completed, 0)
  assert.equal(collection.completed, 1)
  assert.equal(collection.roles.length, players.length)
  assert.equal(collection.roles.reduce((sum, role) => sum + role.impostor, 0), 1)
  assert.ok(collection.roles.every(role => role.rounds === 1))
})
