import { api } from './api'
import { usePoll } from './usePoll'
import type { Match } from './types'
import { teamLabel } from './teams'

// Турнирные таблицы групп («положняк»). Считаем прямо из матчей в базе:
// 3 очка за победу, 1 за ничью. Сортировка: очки → разница → забитые.
// (Упрощённо — без личных встреч; для обзора этого достаточно.)

type Row = {
  team: string
  p: number; w: number; d: number; l: number
  gf: number; ga: number; pts: number
}

function standings(matches: Match[]): Row[] {
  const t: Record<string, Row> = {}
  const ensure = (name: string) => (t[name] ??= { team: name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 })

  // сначала заводим все команды группы (даже без сыгранных матчей)
  for (const m of matches) {
    if (m.home_team) ensure(m.home_team)
    if (m.away_team) ensure(m.away_team)
  }
  // считаем сыгранные
  for (const m of matches) {
    if (m.status !== 'FINISHED' || m.home_goals == null || m.away_goals == null) continue
    if (!m.home_team || !m.away_team) continue
    const h = ensure(m.home_team), a = ensure(m.away_team)
    h.p++; a.p++
    h.gf += m.home_goals; h.ga += m.away_goals
    a.gf += m.away_goals; a.ga += m.home_goals
    if (m.home_goals > m.away_goals) { h.w++; a.l++; h.pts += 3 }
    else if (m.home_goals < m.away_goals) { a.w++; h.l++; a.pts += 3 }
    else { h.d++; a.d++; h.pts++; a.pts++ }
  }
  return Object.values(t).sort(
    (x, y) =>
      y.pts - x.pts ||
      (y.gf - y.ga) - (x.gf - x.ga) ||
      y.gf - x.gf ||
      x.team.localeCompare(y.team),
  )
}

function diff(r: Row): string {
  const d = r.gf - r.ga
  return (d > 0 ? '+' : '') + d
}

export default function Groups() {
  // Авто-обновление каждые 30 сек: таблицы групп считаются из результатов матчей.
  const { data: matches, err } = usePoll(() => api.matches(), 30000)

  if (err && !matches) return <p className="error screen-msg">{err}</p>
  if (!matches) return <p className="screen-msg">Загрузка…</p>

  // группируем матчи группового этапа по группе
  const byGroup: Record<string, Match[]> = {}
  for (const m of matches) {
    if (m.stage !== 'GROUP_STAGE' || !m.group_name) continue
    ;(byGroup[m.group_name] ??= []).push(m)
  }
  const groups = Object.keys(byGroup).sort()
  if (groups.length === 0) return <p className="screen-msg">Группы ещё не загружены.</p>

  return (
    <div className="groups">
      {groups.map((gname) => {
        const rows = standings(byGroup[gname])
        const played = byGroup[gname].some((m) => m.status === 'FINISHED')
        return (
          <section key={gname} className="group-box">
            <h3>{gname.replace('GROUP_', 'Группа ')}</h3>
            <table className="group-table">
              <thead>
                <tr>
                  <th></th><th className="g-team">Команда</th>
                  <th>И</th><th>В</th><th>Н</th><th>П</th><th>±</th><th>О</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.team} className={i < 2 ? 'qualifies' : ''}>
                    <td className="g-pos">{i + 1}</td>
                    <td className="g-team">{teamLabel(r.team)}</td>
                    <td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td>
                    <td>{diff(r)}</td><td><b>{r.pts}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!played && <p className="small">Матчи группы ещё не сыграны.</p>}
          </section>
        )
      })}
      <p className="small footnote">
        Зелёным — первые две команды (выходят из группы напрямую). Сортировка: очки → разница
        мячей → забитые.
      </p>
    </div>
  )
}
