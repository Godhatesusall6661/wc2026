import { useEffect, useState } from 'react'
import { api, errText } from './api'
import { usePoll } from './usePoll'
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
// Миасс = Челябинская область, UTC+5 (на 2 часа впереди Москвы)
const miassFmt = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yekaterinburg',
})

// Зеркало match_points из supabase/schema.sql — только для отображения,
// источник истины считает база.
export function matchPoints(ph: number, pa: number, rh: number, ra: number): number {
  // Исход не угадан → 0 (ни разница, ни ошибка на 1 гол не считаются).
  if (Math.sign(ph - pa) !== Math.sign(rh - ra)) return 0
  let pts = 3
  if (ph - pa === rh - ra) pts += 4
  else if (Math.abs(ph - pa - (rh - ra)) === 1) pts += 2
  if (ph === rh && pa === ra) pts += 3
  if (ph - pa === rh - ra && Math.abs(rh - ra) >= 3) pts += 1
  return pts
}

function plural(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return `${n} игровой день`
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} игровых дня`
  return `${n} игровых дней`
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

  // Авто-обновление счетов/статусов/кэфов каждые 30 сек + при возврате на вкладку.
  // Обновляем ТОЛЬКО список матчей — черновики прогнозов (drafts) не трогаем,
  // чтобы не затереть то, что игрок сейчас вводит.
  useEffect(() => {
    const refresh = () => api.matches().then(setMatches).catch(() => {})
    const id = setInterval(refresh, 30000)
    const onVisible = () => {
      if (!document.hidden) refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

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

  // По умолчанию всегда открыты ближайшие ≥5 матчей (можно ставить заранее).
  let visibleDays = days
  if (!showAll) {
    visibleDays = []
    let cnt = 0
    for (const d of days) {
      visibleDays.push(d)
      cnt += d.items.length
      if (cnt >= 5) break
    }
  }

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
      {days.length > visibleDays.length && (
        <button className="show-all" onClick={() => setShowAll(!showAll)}>
          {showAll ? '↑ Свернуть до ближайших' : `Показать всё расписание (ещё ${plural(days.length - visibleDays.length)})`}
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
          {live
            ? '● идёт'
            : finished
              ? 'завершён'
              : `${timeFmt.format(new Date(m.kickoff))} мск · ${miassFmt.format(new Date(m.kickoff))} Миасс`}
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
      {m.home_team && m.away_team && <AllPredictions matchId={m.id} />}
    </div>
  )
}

function AllPredictions({ matchId }: { matchId: number }) {
  const [open, setOpen] = useState(false)
  // Пока блок раскрыт — обновляем каждые 30 сек: до начала матча игроки могут
  // переставить прогноз, и список должен показывать актуальные ставки.
  const { data: preds, err } = usePoll(() => api.matchPredictions(matchId), 30000, open)

  return (
    <details
      className="all-preds"
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary>Прогнозы всех</summary>
      {open && err && !preds && <p className="error">{err}</p>}
      {open && !preds && !err && <p className="small">Загрузка…</p>}
      {open && preds && preds.length === 0 && (
        <p className="small">Никто не дал прогноз на этот матч.</p>
      )}
      {open && preds && preds.length > 0 && (
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
