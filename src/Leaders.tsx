import { useState } from 'react'
import { api } from './api'
import { usePoll } from './usePoll'
import { teamLabel } from './teams'
import Grid from './Grid'

export default function Leaders() {
  const [view, setView] = useState<'grid' | 'table'>('grid')
  return (
    <div>
      <div className="seg">
        <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')}>
          Сетка прогнозов
        </button>
        <button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>
          Таблица лидеров
        </button>
      </div>
      {view === 'grid' ? <Grid /> : <LeaderTable />}
    </div>
  )
}

function LeaderTable() {
  const { data: rows, err } = usePoll(() => api.leaderboard(), 30000)

  if (err && !rows) return <p className="error screen-msg">{err}</p>
  if (!rows) return <p className="screen-msg">Загрузка…</p>
  if (rows.length === 0) return <p className="screen-msg">Пока никто не зарегистрировался.</p>

  const medals = ['🥇', '🥈', '🥉']

  return (
    <>
      <table className="leaders">
        <thead>
          <tr>
            <th></th>
            <th>Игрок</th>
            <th>Чемпион</th>
            <th title="Точно угаданные счета">Точные</th>
            <th>Итого</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name}>
              <td>{medals[i] ?? i + 1}</td>
              <td>{r.name}</td>
              <td className="champ-cell">{r.champion_team ? teamLabel(r.champion_team) : '—'}</td>
              <td>{r.exact_hits}</td>
              <td><b>{r.total}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small footnote">При равенстве очков выше тот, у кого больше точно угаданных счетов.</p>
    </>
  )
}
