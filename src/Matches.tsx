import { useEffect, useState } from 'react'
import { api, errText } from './api'
import type { Match, MatchPrediction } from './types'
import { teamLabel, stageLabel } from './teams'
import TeamSheet from './TeamSheet'

// всё время конкурса — московское
const dayFmt = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short', day: 'numeric', month: 'long', timeZone: 'Europe/Moscow',
})
const timeFmt = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow',
})

// Зеркало match_points из supabase/schema.sql — только для отображения,
// источник истины считает база.
export function matchPoints(ph: number, pa: number, rh: number, ra: number): number {
  let pts = 0
  if (Math.sign(ph - pa) === Math.sign(rh - ra)) pts += 3
  if (ph - pa === rh - ra) pts += 4
  else if (Math.abs(ph - pa - (rh - ra)) === 1) pts += 2
  if (ph === rh && pa === ra) pts += 3
  if (ph - pa === rh - ra && Math.abs(rh - ra) >= 3) pts += 1
  return pts
}

type Draft = { h: string; a: string; saved: boolean; busy?: boolean; err?: string }

export default function Matches({ token }: { token: string }) {
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const [err, setErr] = useState<string | null>(null)
  const [openTeam, setOpenTeam] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    Promise.all([api.matches(), api.myPredictions(token)])
      .then(([ms, preds]) => {
        const d: Record<number, Draft> = {}
        for (const p of preds) {
          d[p.match_id] = { h: String(p.home_goals), a: String(p.away_goals), saved: true }
        }
        setMatches(ms)
        setDrafts(d)
      })
      .catch((e) => setErr(errText(e)))
  }, [token])

  function setDraft(id: number, d: Draft) {
    setDrafts((prev) => ({ ...prev, [id]: d }))
  }

  async function save(m: Match) {
    const d = drafts[m.id]
    if (!d) return
    setDraft(m.id, { ...d, busy: true, err: undefined })
    try {
      await api.savePrediction(token, m.id, Number(d.h), Number(d.a))
      setDraft(m.id, { h: d.h, a: d.a, saved: true })
    } catch (e) {
      setDraft(m.id, { ...d, busy: false, err: errText(e) })
    }
  }

  if (err) return <p className="error screen-msg">{err}</p>
  if (!matches) return <p className="screen-msg">Загрузка…</p>
  if (matches.length === 0) return <p className="screen-msg">Расписание ещё не загружено.</p>

  const now = Date.now()
  const upcoming = matches.filter((m) => m.status !== 'FINISHED')
  const finished = matches.filter((m) => m.status === 'FINISHED').reverse()

  const days: { label: string; items: Match[] }[] = []
  for (const m of upcoming) {
    const label = dayFmt.format(new Date(m.kickoff))
    const last = days[days.length - 1]
    if (last && last.label === label) last.items.push(m)
    else days.push({ label, items: [m] })
  }

  const visibleDays = showAll ? days : days.slice(0, 2)

  return (
    <div>
      {visibleDays.map((day) => (
        <section key={day.label}>
          <h2 className="day">{day.label}</h2>
          {day.items.map((m) => (
            <MatchCard
              key={m.id}
              m={m}
              draft={drafts[m.id]}
              now={now}
              onChange={(d) => setDraft(m.id, d)}
              onSave={() => save(m)}
              onTeam={setOpenTeam}
            />
          ))}
        </section>
      ))}
      {days.length > 2 && (
        <button className="show-all" onClick={() => setShowAll(!showAll)}>
          {showAll ? '↑ Свернуть до ближайших' : `Показать всё расписание (ещё ${days.length - 2} игровых дней)`}
        </button>
      )}
      {finished.length > 0 && (
        <details className="finished-block">
          <summary>Завершённые матчи ({finished.length})</summary>
          {finished.map((m) => (
            <MatchCard
              key={m.id} m={m} draft={drafts[m.id]} now={now}
              onChange={() => {}} onSave={() => {}} onTeam={setOpenTeam}
            />
          ))}
        </details>
      )}
      {openTeam && <TeamSheet team={openTeam} matches={matches} onClose={() => setOpenTeam(null)} />}
    </div>
  )
}

function MatchCard({
  m, draft, now, onChange, onSave, onTeam,
}: {
  m: Match
  draft?: Draft
  now: number
  onChange: (d: Draft) => void
  onSave: () => void
  onTeam: (team: string) => void
}) {
  const started = new Date(m.kickoff).getTime() <= now
  const finished = m.status === 'FINISHED'
  const live = started && !finished
  const canEdit = !started && !!m.home_team && !!m.away_team
  const d = draft ?? { h: '', a: '', saved: false }
  const canSave = d.h !== '' && d.a !== '' && !d.busy && !d.saved

  const myPts =
    finished && d.saved && m.home_goals != null && m.away_goals != null
      ? matchPoints(Number(d.h), Number(d.a), m.home_goals, m.away_goals)
      : null

  return (
    <div className={'card' + (live ? ' live' : '')}>
      <div className="card-top">
        <span className="stage">{stageLabel(m)}</span>
        <span className="time">
          {live ? '● идёт' : finished ? 'завершён' : `${timeFmt.format(new Date(m.kickoff))} мск`}
        </span>
      </div>
      <div className="card-row">
        <span className="team home">
          {m.home_team ? (
            <button className="team-btn" onClick={() => onTeam(m.home_team!)}>{teamLabel(m.home_team)}</button>
          ) : (
            '—'
          )}
        </span>
        {canEdit ? (
          <span className="score-input">
            <input
              inputMode="numeric"
              maxLength={2}
              value={d.h}
              onChange={(e) => onChange({ ...d, h: e.target.value.replace(/\D/g, ''), saved: false })}
            />
            :
            <input
              inputMode="numeric"
              maxLength={2}
              value={d.a}
              onChange={(e) => onChange({ ...d, a: e.target.value.replace(/\D/g, ''), saved: false })}
            />
          </span>
        ) : (
          <span className="score">
            {m.home_goals != null ? `${m.home_goals}:${m.away_goals}` : started ? '—' : 'vs'}
          </span>
        )}
        <span className="team away">
          {m.away_team ? (
            <button className="team-btn" onClick={() => onTeam(m.away_team!)}>{teamLabel(m.away_team)}</button>
          ) : (
            '—'
          )}
        </span>
      </div>
      {!started && m.odds_home != null && (
        <div className="odds" title="Коэффициенты букмекеров: П1 / ничья / П2">
          кф {Number(m.odds_home).toFixed(2)} / {Number(m.odds_draw).toFixed(2)} / {Number(m.odds_away).toFixed(2)}
        </div>
      )}
      {canEdit && (
        <div className="card-actions">
          <button onClick={onSave} disabled={!canSave}>
            {d.busy ? 'Сохраняю…' : d.saved ? '✓ Сохранено' : 'Сохранить'}
          </button>
          {d.err && <span className="error">{d.err}</span>}
        </div>
      )}
      {started && d.saved && (
        <div className="my-pred">
          Мой прогноз: {d.h}:{d.a}
          {myPts != null && <b> → +{myPts}</b>}
        </div>
      )}
      {finished && m.winner && m.home_goals != null && m.home_goals === m.away_goals && (
        <div className="pens">По пенальти дальше: {teamLabel(m.winner)}</div>
      )}
      {started && <AllPredictions matchId={m.id} />}
    </div>
  )
}

function AllPredictions({ matchId }: { matchId: number }) {
  const [preds, setPreds] = useState<MatchPrediction[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  return (
    <details
      className="all-preds"
      onToggle={(e) => {
        if ((e.target as HTMLDetailsElement).open && !preds && !err) {
          api.matchPredictions(matchId).then(setPreds).catch((er) => setErr(errText(er)))
        }
      }}
    >
      <summary>Прогнозы всех</summary>
      {err && <p className="error">{err}</p>}
      {!preds && !err && <p className="small">Загрузка…</p>}
      {preds && preds.length === 0 && <p className="small">Никто не дал прогноз на этот матч.</p>}
      {preds && preds.length > 0 && (
        <table>
          <tbody>
            {preds.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td>{p.home_goals}:{p.away_goals}</td>
                <td>{p.points != null ? `+${p.points}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </details>
  )
}
