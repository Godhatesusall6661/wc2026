import { useEffect, useState } from 'react'
import { api, errText } from './api'
import type { ChampionState } from './types'
import { teamLabel } from './teams'

const dtFmt = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow',
})

export default function Champion({ token }: { token: string }) {
  const [st, setSt] = useState<ChampionState | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState(false)

  function load() {
    api
      .championState(token)
      .then((s) => {
        setSt(s)
        setSel(s.my_pick)
      })
      .catch((e) => setErr(errText(e)))
  }
  useEffect(load, [token])

  if (err && !st) return <p className="error screen-msg">{err}</p>
  if (!st) return <p className="screen-msg">Загрузка…</p>

  const open =
    st.deadline != null && new Date(st.deadline).getTime() > Date.now() && st.teams.length > 0

  async function save() {
    if (!sel) return
    setBusy(true)
    setErr(null)
    setSavedMsg(false)
    try {
      await api.saveChampion(token, sel)
      setSavedMsg(true)
      load()
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="champion">
      <h2>Чемпион турнира</h2>
      <p>
        Перед 1/4 финала каждый выбирает будущего чемпиона. Если ваша команда выигрывает
        полуфинал — <b>+5</b>, выигрывает финал — ещё <b>+5</b>.
      </p>
      {st.teams.length === 0 ? (
        <p className="screen-msg">
          Участники 1/4 финала ещё не определились.
          <br />
          Выбор откроется после матчей 1/8 финала.
        </p>
      ) : open ? (
        <>
          <p className="deadline">
            Выбор закроется {dtFmt.format(new Date(st.deadline!))} мск — со стартом первого
            четвертьфинала.
          </p>
          <div className="team-grid">
            {st.teams.map((t) => (
              <button
                key={t}
                className={sel === t ? 'sel' : ''}
                onClick={() => {
                  setSel(t)
                  setSavedMsg(false)
                }}
              >
                {teamLabel(t)}
              </button>
            ))}
          </div>
          <button className="primary" disabled={busy || !sel || sel === st.my_pick} onClick={save}>
            {busy ? 'Сохраняю…' : st.my_pick ? 'Изменить выбор' : 'Выбрать'}
          </button>
          {st.my_pick && <p className="small">Ваш текущий выбор: {teamLabel(st.my_pick)}</p>}
          {savedMsg && <p className="ok">Сохранено!</p>}
          {err && <p className="error">{err}</p>}
        </>
      ) : (
        <>
          <p className="deadline">Выбор закрыт.</p>
          {st.my_pick ? (
            <p>Ваш чемпион: <b>{teamLabel(st.my_pick)}</b></p>
          ) : (
            <p>Вы не успели выбрать чемпиона.</p>
          )}
          {st.picks && st.picks.length > 0 && (
            <table className="leaders">
              <tbody>
                {st.picks.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td>{teamLabel(p.team)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}
