import { useEffect, useState } from 'react'
import { api, errText } from './api'
import type { GridRow, LeaderRow } from './types'
import { teamFlag, teamLabel, stageLabel } from './teams'

// Общая «сетка»: строки — игроки, столбцы — начавшиеся матчи, в ячейке прогноз и очки.
// Делится на групповой этап и плей-офф (как просил организатор).

// Цвет ячейки по очкам: 0 — без заливки, чем больше — тем зеленее (макс 11).
// Текст всегда тёмный, поэтому фон держим достаточно светлым (не уходим в тёмный).
function ptsBg(pts: number | null | undefined): string | undefined {
  if (pts == null || pts <= 0) return undefined
  const t = Math.min(pts, 11) / 11
  return `hsl(140 60% ${92 - t * 30}%)` // 92% (бледный) → 62% (насыщенный, но текст читаем)
}

type Cell = { pred: string; points: number | null }
type MatchCol = {
  id: number
  header: string // флаги пары
  result: string // счёт или '—'
  title: string // для подсказки
}

function buildSection(rows: GridRow[], names: string[]) {
  const matchMap = new Map<number, MatchCol>()
  const cells = new Map<string, Cell>() // ключ `${matchId}|${name}`

  for (const r of rows) {
    if (!matchMap.has(r.match_id)) {
      matchMap.set(r.match_id, {
        id: r.match_id,
        header: `${teamFlag(r.home_team)}${teamFlag(r.away_team)}`,
        result:
          r.home_goals != null && r.away_goals != null ? `${r.home_goals}:${r.away_goals}` : '—',
        title: `${teamLabel(r.home_team)} — ${teamLabel(r.away_team)} (${stageLabel(r)})`,
      })
    }
    cells.set(`${r.match_id}|${r.participant}`, {
      pred: `${r.pred_home}:${r.pred_away}`,
      points: r.points,
    })
  }

  const cols = [...matchMap.values()]
  // суммарные очки по этой секции для строки игрока
  const rowTotal = new Map<string, number>()
  for (const r of rows) {
    if (r.points != null) rowTotal.set(r.participant, (rowTotal.get(r.participant) ?? 0) + r.points)
  }
  return { cols, cells, rowTotal, names }
}

function Matrix({
  title, rows, names,
}: {
  title: string
  rows: GridRow[]
  names: string[]
}) {
  if (rows.length === 0) {
    return (
      <section className="grid-section">
        <h3>{title}</h3>
        <p className="small">Матчей этого этапа пока не было — заполнится после первых игр.</p>
      </section>
    )
  }
  const { cols, cells, rowTotal } = buildSection(rows, names)

  return (
    <section className="grid-section">
      <h3>{title}</h3>
      <div className="grid-wrap">
        <table className="grid-table">
          <thead>
            <tr>
              <th className="g-rank">#</th>
              <th className="g-name">Игрок</th>
              {cols.map((c) => (
                <th key={c.id} title={c.title}>
                  <span className="g-flags">{c.header}</span>
                  <span className="g-res">{c.result}</span>
                </th>
              ))}
              <th className="g-sum">Σ</th>
            </tr>
          </thead>
          <tbody>
            {names.map((name, i) => (
              <tr key={name}>
                <td className="g-rank">{i + 1}</td>
                <td className="g-name">{name}</td>
                {cols.map((c) => {
                  const cell = cells.get(`${c.id}|${name}`)
                  const bg = ptsBg(cell?.points)
                  return (
                    <td
                      key={c.id}
                      className={cell?.points ? 'has-pts' : ''}
                      style={bg ? { background: bg } : undefined}
                    >
                      {cell ? (
                        <>
                          <span className="g-pred">{cell.pred}</span>
                          {cell.points != null && <span className="g-pts">+{cell.points}</span>}
                        </>
                      ) : (
                        <span className="g-empty">·</span>
                      )}
                    </td>
                  )
                })}
                <td className="g-sum">{rowTotal.get(name) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function Grid() {
  const [grid, setGrid] = useState<GridRow[] | null>(null)
  const [leaders, setLeaders] = useState<LeaderRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.grid(), api.leaderboard()])
      .then(([g, l]) => {
        setGrid(g)
        setLeaders(l)
      })
      .catch((e) => setErr(errText(e)))
  }, [])

  if (err) return <p className="error screen-msg">{err}</p>
  if (!grid || !leaders) return <p className="screen-msg">Загрузка…</p>

  // строки — все игроки в порядке таблицы лидеров
  const names = leaders.map((l) => l.name)
  const groupRows = grid.filter((r) => r.stage === 'GROUP_STAGE')
  const koRows = grid.filter((r) => r.stage !== 'GROUP_STAGE')

  if (grid.length === 0) {
    return (
      <p className="screen-msg">
        Матчи ещё не начинались.
        <br />
        Сетка заполнится после первых игр — прогнозы открываются по свистку.
      </p>
    )
  }

  return (
    <div className="grid-view">
      <Matrix title="Групповой этап" rows={groupRows} names={names} />
      <Matrix title="Плей-офф" rows={koRows} names={names} />
      <p className="small footnote">
        В ячейке — прогноз и набранные очки. Σ — сумма очков за этап. Прогнозы видны только по
        начавшимся матчам.
      </p>
    </div>
  )
}
