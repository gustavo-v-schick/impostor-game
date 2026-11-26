const test = require('node:test')
const assert = require('node:assert/strict')
const { createRound, getPlayerCard, getHints, wordKey, words, matchesWordDifficulty, areSimilar } = require('../.test-build/game/round.js')

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

const { emptyCollection, getWordScore, rateWord, toggleBlocked, rateClue, filterWords, recordCompleted } = require('../.test-build/game/collection.js')

test('ratings do not affect eligibility, draw probabilities or history', () => {
  const rated = rateWord(rateWord(emptyCollection(), 'Pinguim', 5), 'Xadrez', 1)
  const ratedPool = filterWords(pool, rated)
  assert.deepEqual(ratedPool, pool)
  for (const value of [0, 0.33, 0.5, 0.66, 0.99]) {
    const random = () => value
    for (const history of [[], ['pinguim']]) {
      assert.deepEqual(createRound(players, history, { ...options, pool: ratedPool }, random), createRound(players, history, options, random))
    }
  }
  assert.equal(createRound(players, [], { ...options, pool: ratedPool }, () => 0.99).entry.word, 'Espelho')
  assert.equal(getWordScore(rated, 'PINGUIM'), 5)
  assert.equal(getWordScore(rateWord(rated, 'Pinguim', null), 'Pinguim'), null)
})

test('blocking excludes words without changing their rating; unblocking restores availability', () => {
  let collection = rateWord(emptyCollection(), 'Pinguim', 5)
  collection = toggleBlocked(collection, 'PINGUIM')
  assert.equal(getWordScore(collection, 'Pinguim'), 5)
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

test('all catalog words have a preliminary difficulty and valid similarity groups', () => {
  const groups = new Map()
  for (const entry of words) {
    assert.ok(['easy', 'medium', 'hard'].includes(entry.wordDifficulty), entry.word)
    for (const group of entry.similarityGroups ?? []) groups.set(group, (groups.get(group) ?? 0) + 1)
  }
  for (const size of groups.values()) assert.ok(size >= 2)
})

test('word difficulty is independent of clue difficulty', () => {
  const items = [
    { ...pool[0], wordDifficulty: 'easy' },
    { ...pool[1], wordDifficulty: 'hard' },
  ]
  const round = createRound(players, [], { ...options, pool: items, wordDifficulty: 'easy', difficulty: 'hard' }, first)
  assert.equal(round.entry.word, 'Pinguim')
  assert.equal(round.entry.clue, 'Marcha')
  assert.equal(matchesWordDifficulty({ word: 'Custom', category: 'Personalizadas', clue: 'Teste' }, 'medium'), true)
  assert.equal(matchesWordDifficulty(items[1], 'all'), true)
})

test('related words are skipped only when another unused candidate exists', () => {
  const items = [
    { ...pool[0], similarityGroups: ['pair'] },
    { ...pool[1], similarityGroups: ['pair'] },
    pool[2],
  ]
  assert.ok(areSimilar(items[0], items[1]))
  const varied = createRound(players, ['pinguim'], { ...options, pool: items, previousWord: 'pinguim', avoidSimilar: true }, first)
  assert.equal(varied.entry.word, 'Espelho')
  const fallback = createRound(players, ['pinguim', 'espelho'], { ...options, pool: items, previousWord: 'pinguim', avoidSimilar: true }, first)
  assert.equal(fallback.entry.word, 'Xadrez')
  const disabled = createRound(players, ['pinguim'], { ...options, pool: items, previousWord: 'pinguim', avoidSimilar: false }, first)
  assert.equal(disabled.entry.word, 'Xadrez')
})
