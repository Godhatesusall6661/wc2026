import type { Match } from './types'
import { teamLabel, stageLabel } from './teams'

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' })
const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })

type Res = 'В' | 'Н' | 'П'

function resFor(team: string, m: Match): Res | null {
  if (m.status !== 'FINISHED' || m.home_goals == null || m.away_goals == null) return null
  const my = m.home_team === team ? m.home_goals : m.away_goals
  const op = m.home_team === team ? m.away_goals : m.home_goals
  return my > op ? 'В' : my < op ? 'П' : 'Н'
}

export default function TeamSheet({
  team, matches, onClose,
}: {
  team: string
  matches: Match[]
  onClose: () => void
}) {
  const own = matches.filter((m) => m.home_team === team || m.away_team === team)
  const played = own.filter((m) => m.status === 'FINISHED' && m.home_goals != null)

  let w = 0, d = 0, l = 0, gf = 0, ga = 0
  for (const m of played) {
    const r = resFor(team, m)
    if (r === 'В') w++
    else if (r === 'Н') d++
    else l++
    gf += m.home_team === team ? m.home_goals! : m.away_goals!
    ga += m.home_team === team ? m.away_goals! : m.home_goals!
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>{teamLabel(team)} на ЧМ-2026</h3>
          <button className="ghost" onClick={onClose}>✕</button>
        </div>
        {played.length > 0 && (
          <p className="ts-summary">
            Игры {played.length} · В {w} · Н {d} · П {l} · мячи {gf}:{ga}
          </p>
        )}
        {own.map((m) => {
          const r = resFor(team, m)
          const started = new Date(m.kickoff).getTime() <= Date.now()
          const kick = new Date(m.kickoff)
          return (
            <div className="ts-row" key={m.id}>
              <span className="ts-date">
                {dateFmt.format(kick)}
                <span className="small"> {stageLabel(m)}</span>
              </span>
              <span className="ts-pair">
                {m.home_team === team ? <b>{teamLabel(m.home_team)}</b> : teamLabel(m.home_team)}
                {' — '}
                {m.away_team === team ? <b>{teamLabel(m.away_team)}</b> : teamLabel(m.away_team)}
              </span>
              <span className="ts-score">
                {m.home_goals != null
                  ? `${m.home_goals}:${m.away_goals}`
                  : started
                    ? '—'
                    : timeFmt.format(kick)}
              </span>
              {r ? (
                <span className={'res-badge res-' + (r === 'В' ? 'w' : r === 'Н' ? 'd' : 'l')}>{r}</span>
              ) : (
                <span className="res-badge res-none" />
              )}
            </div>
          )
        })}
        {own.every((m) => m.status !== 'FINISHED') && (
          <p className="small">Сыгранных матчей пока нет — расписание выше.</p>
        )}
      </div>
    </div>
  )
}
