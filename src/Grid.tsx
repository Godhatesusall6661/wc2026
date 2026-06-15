import { useEffect, useRef } from 'react'
import { api } from './api'
import { usePoll } from './usePoll'
import type { GridRow } from './types'
import { teamFlag, teamLabel, stageLabel } from './teams'

// Дата + время последнего обновления — видно и что ставки «живые», и сегодняшнее число.
const clockFmt = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short', day: '2-digit', month: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Moscow',
})

// Общая «сетка»: строки — игроки, столбцы — начавшиеся матчи, в ячейке прогноз и очки.
// Делится на групповой этап и плей-офф (как просил организатор).

// Время начала ближайших (ещё не сыгранных) матчей — в шапке столбца вместо счёта.
const colTimeFmt = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow',
})
const colDateFmt = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short', day: 'numeric', month: 'long',
  hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow',
})
// Компактная дата для шапки предстоящего матча: «пн 15.06».
const colHeaderDateFmt = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'Europe/Moscow',
})

// Цвет ячейки по очкам: 0 — без заливки, чем больше — тем зеленее (макс 11).
// Текст всегда тёмный, поэтому фон держим достаточно светлым (не уходим в тёмный).
function ptsBg(pts: number | null | undefined): string | undefined {
  if (pts == null || pts <= 0) return undefined
  const t = Math.min(pts, 11) / 11
  return `hsl(140 60% ${92 - t * 30}%)` // 92% (бледный) → 62% (насыщенный, но текст читаем)
}

type Cell = { pred: string; points: number | null }
type MatchState = 'finished' | 'live' | 'upcoming'
type MatchCol = {
  id: number
  header: string // флаги пары
  result: string // счёт / 'идёт' / время начала
  date?: string // дата начала (только для предстоящих) — над временем
  state: MatchState
  title: string // для подсказки
}

function buildSection(rows: GridRow[], names: string[]) {
  const matchMap = new Map<number, MatchCol>()
  const cells = new Map<string, Cell>() // ключ `${matchId}|${name}`

  for (const r of rows) {
    if (!matchMap.has(r.match_id)) {
      const finished = r.status === 'FINISHED' && r.home_goals != null && r.away_goals != null
      const state: MatchState = finished
        ? 'finished'
        : new Date(r.kickoff).getTime() <= Date.now()
          ? 'live'
          : 'upcoming'
      matchMap.set(r.match_id, {
        id: r.match_id,
        header: `${teamFlag(r.home_team)}${teamFlag(r.away_team)}`,
        result:
          state === 'finished'
            ? `${r.home_goals}:${r.away_goals}`
            : state === 'live'
              ? 'идёт'
              : colTimeFmt.format(new Date(r.kickoff)),
        date: state === 'upcoming' ? colHeaderDateFmt.format(new Date(r.kickoff)) : undefined,
        state,
        title:
          `${teamLabel(r.home_team)} — ${teamLabel(r.away_team)} (${stageLabel(r)})` +
          (finished ? '' : ` · ${colDateFmt.format(new Date(r.kickoff))}`),
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
  title, rows, names, scrollToEnd = true,
}: {
  title: string
  rows: GridRow[]
  names: string[]
  scrollToEnd?: boolean
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const built = rows.length ? buildSection(rows, names) : null
  const colCount = built?.cols.length ?? 0
  const hasUpcoming = built?.cols.some((c) => c.state !== 'finished') ?? false

  // Есть текущие/предстоящие матчи → проматываем сетку к правому краю, чтобы
  // свежие столбцы (ближайшие ставки) и Σ были видны сразу, без ручного скролла.
  // В режиме скрина (scrollToEnd=false) не трогаем — кадр должен начинаться слева.
  useEffect(() => {
    const el = wrapRef.current
    if (el && scrollToEnd && hasUpcoming) el.scrollLeft = el.scrollWidth
  }, [colCount, hasUpcoming, scrollToEnd])

  if (!built) {
    return (
      <section className="grid-section">
        <h3>{title}</h3>
        <p className="small">Матчей этого этапа пока не было — заполнится после первых игр.</p>
      </section>
    )
  }
  const { cols, cells, rowTotal } = built

  return (
    <section className="grid-section">
      <h3>{title}</h3>
      <div className="grid-wrap" ref={wrapRef}>
        <table className="grid-table">
          <thead>
            <tr>
              <th className="g-rank">#</th>
              <th className="g-name">Игрок</th>
              {cols.map((c) => (
                <th
                  key={c.id}
                  title={c.title}
                  className={
                    c.state === 'upcoming' ? 'col-soon' : c.state === 'live' ? 'col-live' : undefined
                  }
                >
                  <span className="g-flags">{c.header}</span>
                  {c.date && <span className="g-date">{c.date}</span>}
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

export default function Grid({
  full = false,
  includeUpcoming = true,
  heading,
}: {
  full?: boolean
  includeUpcoming?: boolean
  heading?: string
}) {
  // Авто-обновление каждые 30 сек: ставки на ближайшие матчи редактируемы до
  // начала, и грид должен показывать актуальные значения, а не закэшированные.
  const { data, err, refreshing, updatedAt, reload } = usePoll(
    () => Promise.all([api.grid(), api.leaderboard()]).then(([g, l]) => ({ g, l })),
    30000,
  )

  if (err && !data) return <p className="error screen-msg">{err}</p>
  if (!data) return <p className="screen-msg">Загрузка…</p>

  // Режим скрина (includeUpcoming=false): убираем столбцы ещё не начавшихся
  // матчей — в таблице только сыгранные/идущие. Σ не меняется (у будущих очков нет).
  const now = Date.now()
  const grid = includeUpcoming
    ? data.g
    : data.g.filter((r) => new Date(r.kickoff).getTime() <= now)
  // строки — все игроки в порядке таблицы лидеров
  const names = data.l.map((l) => l.name)
  const groupRows = grid.filter((r) => r.stage === 'GROUP_STAGE')
  const koRows = grid.filter((r) => r.stage !== 'GROUP_STAGE')

  const bar = (
    <div className="refresh-bar">
      <span className="small">
        {updatedAt ? `ставки актуальны на ${clockFmt.format(updatedAt)}` : 'обновляю…'}
        {refreshing && updatedAt ? ' · обновляю…' : ''}
        {err && updatedAt ? ' · ⚠ сеть' : ''}
      </span>
      <button className="link-btn" onClick={() => reload()} disabled={refreshing} title="Обновить сейчас">
        🔄
      </button>
    </div>
  )

  const viewClass = 'grid-view' + (full ? ' grid-view--full' : '')

  if (grid.length === 0) {
    return (
      <div className={viewClass}>
        {heading && <h2 className="grid-title">{heading}</h2>}
        {bar}
        <p className="screen-msg">
          {includeUpcoming
            ? 'Пока никто не поставил прогноз.'
            : 'Сыгранных матчей пока нет — таблица заполнится после первых игр.'}
        </p>
      </div>
    )
  }

  return (
    <div className={viewClass}>
      {heading && <h2 className="grid-title">{heading}</h2>}
      {bar}
      <Matrix title="Групповой этап" rows={groupRows} names={names} scrollToEnd={!full} />
      <Matrix title="Плей-офф" rows={koRows} names={names} scrollToEnd={!full} />
      <p className="small footnote">
        {includeUpcoming ? (
          <>
            В ячейке — прогноз, зелёным — набранные очки, Σ — сумма за этап. Ближайшие матчи (со
            временем вместо счёта) показаны заранее: ставки видны всем, очки начислятся после игры.
            Сетка сама обновляется каждые 30 сек — если кто-то поменяет прогноз до начала матча,
            это сразу видно. После начала матча прогноз уже не изменить.
          </>
        ) : (
          <>
            В ячейке — прогноз и набранные очки за матч. Зелёным — очки, Σ — сумма за этап. Показаны
            только сыгранные и идущие матчи (без прогнозов на будущие).
          </>
        )}
      </p>
    </div>
  )
}
