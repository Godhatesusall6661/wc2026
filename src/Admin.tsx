import { useEffect, useState } from 'react'
import { api, errText } from './api'
import type { Match, Person } from './types'
import { teamLabel, STAGES } from './teams'
import Grid from './Grid'

const screenDateFmt = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Moscow',
})

export default function Admin({ token }: { token: string }) {
  const [view, setView] = useState<'grid' | 'manage'>('grid')
  return (
    <div>
      <div className="seg">
        <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')}>
          Сетка для скрина
        </button>
        <button className={view === 'manage' ? 'on' : ''} onClick={() => setView('manage')}>
          Управление
        </button>
      </div>
      {view === 'grid' ? (
        <Grid
          full
          includeUpcoming={false}
          heading={`Прогнозы ЧМ-2026 · ${screenDateFmt.format(Date.now())}`}
        />
      ) : (
        <AdminManage token={token} />
      )}
    </div>
  )
}

function AdminManage({ token }: { token: string }) {
  const [matches, setMatches] = useState<Match[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [err, setErr] = useState<string | null>(null)

  function load() {
    Promise.all([api.matches(), api.adminParticipants(token)])
      .then(([ms, ps]) => {
        setMatches(ms)
        setPeople(ps)
      })
      .catch((e) => setErr(errText(e)))
  }
  useEffect(load, [token])

  async function removePerson(p: Person) {
    if (!confirm(`Удалить игрока «${p.name}» со всеми его прогнозами?`)) return
    try {
      await api.adminDelete(token, p.id)
      load()
    } catch (e) {
      alert(errText(e))
    }
  }

  function copyLink(p: Person) {
    const link = `${location.origin}${location.pathname}#t=${p.token}`
    navigator.clipboard
      .writeText(link)
      .then(() => alert(`Личная ссылка игрока «${p.name}» скопирована`))
  }

  const stages: { key: string; items: Match[] }[] = []
  for (const m of matches) {
    const last = stages[stages.length - 1]
    if (last && last.key === m.stage) last.items.push(m)
    else stages.push({ key: m.stage, items: [m] })
  }

  return (
    <div className="admin">
      {err && <p className="error">{err}</p>}
      <section>
        <h3>Игроки ({people.length})</h3>
        {people.map((p) => (
          <div className="person" key={p.id}>
            <span style={{ flex: 1 }}>
              {p.name}
              {p.is_admin ? ' 👑' : ''}
            </span>
            <button className="ghost" onClick={() => copyLink(p)}>🔗 ссылка</button>
            <button className="ghost danger" onClick={() => removePerson(p)}>удалить</button>
          </div>
        ))}
        <p className="small">
          «🔗 ссылка» — личная ссылка для входа. Выдайте её игроку, если он потерял доступ.
        </p>
      </section>
      <section>
        <h3>Результаты матчей</h3>
        <p className="small">
          Обычно результаты проставляет робот каждые 20 минут — сюда заходить не нужно.
          Если что-то пошло не так: счёт указывается <b>до серии пенальти</b>, «прошёл дальше» —
          кто вышел в следующий раунд (с учётом пенальти).
        </p>
        {stages.map((s) => (
          <details key={s.key}>
            <summary>
              {STAGES[s.key] ?? s.key} ({s.items.length})
            </summary>
            {s.items.map((m) => (
              <MatchEditor key={m.id} token={token} m={m} onSaved={load} />
            ))}
          </details>
        ))}
      </section>
    </div>
  )
}

function MatchEditor({ token, m, onSaved }: { token: string; m: Match; onSaved: () => void }) {
  const [h, setH] = useState(m.home_goals != null ? String(m.home_goals) : '')
  const [a, setA] = useState(m.away_goals != null ? String(m.away_goals) : '')
  const [winner, setWinner] = useState(m.winner ?? '')
  const [finished, setFinished] = useState(m.status === 'FINISHED')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setErr(null)
    try {
      await api.adminSetResult(
        token, m.id,
        h === '' ? null : Number(h),
        a === '' ? null : Number(a),
        winner === '' ? null : winner,
        finished,
      )
      onSaved()
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="m-edit">
      <span className="names">
        {teamLabel(m.home_team)} — {teamLabel(m.away_team)}{' '}
        <span className="small">
          ({new Date(m.kickoff).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} мск, {m.status})
        </span>
      </span>
      <input
        type="text" inputMode="numeric" placeholder="–"
        value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, ''))}
      />
      :
      <input
        type="text" inputMode="numeric" placeholder="–"
        value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ''))}
      />
      {m.home_team && m.away_team && (
        <select value={winner} onChange={(e) => setWinner(e.target.value)}>
          <option value="">прошёл дальше: —</option>
          <option value={m.home_team}>{m.home_team}</option>
          <option value={m.away_team}>{m.away_team}</option>
        </select>
      )}
      <label className="small">
        <input type="checkbox" checked={finished} onChange={(e) => setFinished(e.target.checked)} />{' '}
        завершён
      </label>
      <button className="ghost" disabled={busy} onClick={save}>
        {busy ? '…' : 'Сохранить'}
      </button>
      {err && <span className="error">{err}</span>}
    </div>
  )
}
