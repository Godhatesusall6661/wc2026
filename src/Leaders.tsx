import { useEffect, useState } from 'react'
import { api, errText } from './api'
import type { LeaderRow } from './types'
import { teamFlag } from './teams'

export default function Leaders() {
  const [rows, setRows] = useState<LeaderRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    api.leaderboard().then(setRows).catch((e) => setErr(errText(e)))
  }, [])

  if (err) return <p className="error screen-msg">{err}</p>
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
            <th title="Очки за прогнозы матчей">Матчи</th>
            <th title="Бонус за выбранного чемпиона">Чемп.</th>
            <th title="Точно угаданные счета">Точные</th>
            <th>Итого</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name}>
              <td>{medals[i] ?? i + 1}</td>
              <td>
                {r.name}
                {r.champion_team ? ` ${teamFlag(r.champion_team)}` : ''}
              </td>
              <td>{r.match_points}</td>
              <td>{r.champion_points}</td>
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
