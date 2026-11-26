import { useState } from 'react'
import { words, wordKey } from './game/round'
import type { Round, WordEntry } from './game/round'
import { toggleFavorite, toggleBlocked, rateClue } from './game/collection'
import type { Collection, Rating } from './game/collection'

type Change = (update: (current: Collection) => Collection) => void

export function RoundFeedback({ round, collection, onChange }: { round: Round; collection: Collection; onChange: Change }) {
  const { word, clue } = round.entry
  const key = wordKey(word)
  const favorite = collection.favorites.includes(key)
  const blocked = collection.blocked.includes(key)
  const rating = collection.ratings.find(item => wordKey(item.word) === key && wordKey(item.clue) === wordKey(clue))?.rating
  function rate(value: Rating): void { onChange(current => rateClue(current, word, clue, value)) }
  return (
    <div className="feedback">
      <p className="muted">O que acharam desta palavra?</p>
      <div className="action-pair">
        <button type="button" className="secondary" aria-pressed={favorite} onClick={() => onChange(current => toggleFavorite(current, word))}>{favorite ? 'Favoritada' : 'Favoritar'}</button>
        <button type="button" className="secondary" aria-pressed={blocked} onClick={() => onChange(current => toggleBlocked(current, word))}>{blocked ? 'Desbloquear' : 'Bloquear'}</button>
      </div>
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
  const [mode, setMode] = useState<'all' | 'favorites' | 'blocked'>('favorites')
  const catalog = [...words, ...customWords]
  const matches = catalog.filter(entry => {
    const key = wordKey(entry.word)
    return (mode === 'all' || (mode === 'favorites' ? collection.favorites.includes(key) : collection.blocked.includes(key))) &&
      (!query.trim() || key.includes(wordKey(query)))
  })
  return (
    <details className="panel settings-panel">
      <summary>Gerenciar palavras · {collection.favorites.length} favoritas</summary>
      <div className="settings-content">
        <label htmlFor="collection-mode">Lista</label>
        <select id="collection-mode" value={mode} onChange={event => setMode(event.target.value as typeof mode)}>
          <option value="favorites">Favoritas</option><option value="blocked">Bloqueadas</option><option value="all">Catálogo completo</option>
        </select>
        <label htmlFor="word-search">Buscar palavra</label>
        <input className="word-search" id="word-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Ex.: Pinguim" />
        <p className="muted category-help">{matches.length} resultados{matches.length > 50 ? ' · refine a busca para ver outros' : ''}. Favoritas têm peso dobrado no sorteio.</p>
        <ul className="players collection-list">
          {matches.slice(0, 50).map(entry => {
            const key = wordKey(entry.word)
            const favorite = collection.favorites.includes(key)
            const blocked = collection.blocked.includes(key)
            return <li key={key}>
              <span>{entry.word}<small className="muted"> · {entry.category}</small></span>
              <div className="action-pair">
                <button className="secondary compact" type="button" aria-label={(favorite ? 'Retirar favorito ' : 'Favoritar ') + entry.word} aria-pressed={favorite} onClick={() => onChange(current => toggleFavorite(current, entry.word))}>{favorite ? '★' : '☆'}</button>
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
