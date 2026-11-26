import { useState } from 'react'
import { words, wordKey } from './game/round'
import type { Round, WordEntry } from './game/round'
import { getWordScore, rateWord, toggleBlocked, rateClue } from './game/collection'
import type { Collection, Rating, WordScore } from './game/collection'

type Change = (update: (current: Collection) => Collection) => void

export function RoundFeedback({ round, collection, onChange }: { round: Round; collection: Collection; onChange: Change }) {
  const { word, clue } = round.entry
  const key = wordKey(word)
  const score = getWordScore(collection, word)
  const blocked = collection.blocked.includes(key)
  const rating = collection.ratings.find(item => wordKey(item.word) === key && wordKey(item.clue) === wordKey(clue))?.rating
  function rate(value: Rating): void { onChange(current => rateClue(current, word, clue, value)) }
  return (
    <div className="feedback">
      <p className="muted">Nota da palavra (1 a 5)</p>
      <div className="action-pair" role="group" aria-label="Nota da palavra">
        {([1, 2, 3, 4, 5] as const).map(value => <button key={value} type="button" className="secondary compact" aria-pressed={score === value} onClick={() => onChange(current => rateWord(current, word, score === value ? null : value))}>{value}</button>)}
      </div>
      <p className="muted feedback-note">A nota não altera o sorteio.</p>
      <button type="button" className="secondary" aria-pressed={blocked} onClick={() => onChange(current => toggleBlocked(current, word))}>{blocked ? 'Desbloquear palavra' : 'Bloquear palavra'}</button>
      {round.clueEnabled && <>
        <p className="muted">A dica foi boa?</p>
        <div className="action-pair">
          <button type="button" className="secondary" aria-pressed={rating === 'good'} onClick={() => rate('good')}>Boa</button>
          <button type="button" className="secondary" aria-pressed={rating === 'bad'} onClick={() => rate('bad')}>Ruim</button>
        </div>
      </>}
      <p className="muted feedback-note">Preferências salvas somente neste aparelho.</p>
    </div>
  )
}

export function CollectionPanel({ collection, customWords, onChange }: { collection: Collection; customWords: readonly WordEntry[]; onChange: Change }) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'all' | 'rated' | 'favorites' | 'blocked'>('rated')
  const catalog = [...words, ...customWords]
  const matches = catalog.filter(entry => {
    const key = wordKey(entry.word)
    const score = getWordScore(collection, entry.word)
    return (mode === 'all' || (mode === 'favorites' ? score === 5 : mode === 'rated' ? score !== null : collection.blocked.includes(key))) &&
      (!query.trim() || key.includes(wordKey(query)))
  })
  return (
    <details className="panel settings-panel">
      <summary>Gerenciar palavras · {collection.wordRatings.length} avaliadas</summary>
      <div className="settings-content">
        <label htmlFor="collection-mode">Lista</label>
        <select id="collection-mode" value={mode} onChange={event => setMode(event.target.value as typeof mode)}>
          <option value="rated">Avaliadas</option><option value="favorites">Favoritas (nota 5)</option><option value="blocked">Bloqueadas</option><option value="all">Catálogo completo</option>
        </select>
        <label htmlFor="word-search">Buscar palavra</label>
        <input className="word-search" id="word-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Ex.: Pinguim" />
        <p className="muted category-help">{matches.length} resultados{matches.length > 50 ? ' · refine a busca para ver outros' : ''}. Notas servem apenas para consulta; não alteram o sorteio.</p>
        <ul className="players collection-list">
          {matches.slice(0, 50).map(entry => {
            const key = wordKey(entry.word)
            const score = getWordScore(collection, entry.word)
            const blocked = collection.blocked.includes(key)
            return <li key={key}>
              <span>{entry.word}<small className="muted"> · {entry.category}</small></span>
              <div className="action-pair">
                <select aria-label={'Nota de ' + entry.word} value={score ?? ''} onChange={event => {
                  const value = event.target.value
                  onChange(current => rateWord(current, entry.word, value === '' ? null : Number(value) as WordScore))
                }}><option value="">Sem nota</option>{([1, 2, 3, 4, 5] as const).map(value => <option key={value} value={value}>{value}/5</option>)}</select>
                <button className="secondary compact" type="button" aria-label={(blocked ? 'Desbloquear ' : 'Bloquear ') + entry.word} aria-pressed={blocked} onClick={() => onChange(current => toggleBlocked(current, entry.word))}>{blocked ? 'Liberar' : 'Bloquear'}</button>
              </div>
            </li>
          })}
        </ul>
        {matches.length === 0 && <p className="empty">Nenhuma palavra nesta lista.</p>}
      </div>
    </details>
  )
}

export function StatsPanel({ collection, onChange }: { collection: Collection; onChange: Change }) {
  const good = collection.ratings.filter(item => item.rating === 'good').length
  return (
    <details className="panel settings-panel">
      <summary>Estatísticas locais</summary>
      <div className="stats-grid">
        <div><strong>{collection.completed}</strong><small>Rodadas concluídas</small></div>
        <div><strong>{collection.cancelled}</strong><small>Canceladas</small></div>
        <div><strong>{good}</strong><small>Dicas boas</small></div>
        <div><strong>{collection.ratings.length - good}</strong><small>Dicas ruins</small></div>
      </div>
      <p className="muted category-help">Histórico registrado a partir da versão 1.6.</p>
      {collection.roles.length > 0 && <div className="stats-table-wrap">
        <table className="stats-table"><thead><tr><th>Jogador</th><th>Rodadas</th><th>Impostor</th></tr></thead><tbody>
          {collection.roles.map(item => <tr key={item.name}><td>{item.name}</td><td>{item.rounds}</td><td>{item.impostor}</td></tr>)}
        </tbody></table>
      </div>}
      {collection.ratings.length > 0 && <details className="rating-history"><summary>Dicas avaliadas ({collection.ratings.length})</summary>
        <ul className="players collection-list">{collection.ratings.map(item => <li key={JSON.stringify([item.word, item.clue])}><span>{item.word}<small className="muted"> · {item.clue}</small></span><span>{item.rating === 'good' ? 'Boa' : 'Ruim'}</span></li>)}</ul>
      </details>}
      <button type="button" className="secondary full-width" onClick={() => {
        if (window.confirm('Zerar apenas as estatísticas de rodadas?')) onChange(current => ({ ...current, completed: 0, cancelled: 0, roles: [] }))
      }}>Zerar estatísticas de rodadas</button>
    </details>
  )
}
