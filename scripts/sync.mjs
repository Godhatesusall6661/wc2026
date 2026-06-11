// Синхронизация расписания и результатов ЧМ-2026 из football-data.org
// в Supabase + (опционально) коэффициенты букмекеров из The Odds API.
//
// Запуск локально:  source ~/secrets_champ26.env && npm run sync
// В CI крутится по крону каждые 20 минут (.github/workflows/sync.yml).
//
// Обязательные переменные: FOOTBALL_DATA_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY
// Опциональная: ODDS_API_KEY (нет ключа — коэффициенты просто пропускаются)

const need = (key) => {
  const v = process.env[key]
  if (!v) {
    console.error(`Не задана переменная окружения ${key}`)
    process.exit(1)
  }
  return v
}

const FD_TOKEN = need('FOOTBALL_DATA_TOKEN')
const SB_URL = need('SUPABASE_URL').replace(/\/$/, '')
const SB_KEY = need('SUPABASE_SERVICE_KEY')
const ODDS_KEY = process.env.ODDS_API_KEY ?? null

// --- 1. Матчи из football-data.org ---

const fdRes = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
  headers: { 'X-Auth-Token': FD_TOKEN },
})
if (!fdRes.ok) {
  console.error(`football-data.org: HTTP ${fdRes.status}`, await fdRes.text())
  process.exit(1)
}
const { matches } = await fdRes.json()

const rows = matches.map((m) => {
  const s = m.score ?? {}
  let home = s.fullTime?.home ?? null
  let away = s.fullTime?.away ?? null
  // Правило конкурса: счёт берётся ДО серии пенальти.
  // В v4 fullTime уже не включает пенальти, но на всякий случай
  // пересобираем из периодов, когда была серия.
  if (s.duration === 'PENALTY_SHOOTOUT' && s.regularTime) {
    home = (s.regularTime.home ?? 0) + (s.extraTime?.home ?? 0)
    away = (s.regularTime.away ?? 0) + (s.extraTime?.away ?? 0)
  }
  // А «кто прошёл дальше» — наоборот, с учётом пенальти (для бонуса за чемпиона)
  const winner =
    s.winner === 'HOME_TEAM' ? m.homeTeam?.name :
    s.winner === 'AWAY_TEAM' ? m.awayTeam?.name : null

  return {
    id: m.id,
    stage: m.stage,
    group_name: m.group ?? null,
    kickoff: m.utcDate,
    home_team: m.homeTeam?.name ?? null,
    away_team: m.awayTeam?.name ?? null,
    status: m.status,
    home_goals: home,
    away_goals: away,
    winner,
    // odds_* по умолчанию null на КАЖДОЙ строке — иначе PostgREST ругается
    // на разный набор ключей в bulk-upsert (PGRST102)
    odds_home: null,
    odds_draw: null,
    odds_away: null,
    updated_at: new Date().toISOString(),
  }
})

// --- 2. Коэффициенты (опционально) ---

let oddsApplied = 0
if (ODDS_KEY) {
  try {
    const oddsRes = await fetch(
      `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/?apiKey=${ODDS_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`,
    )
    if (oddsRes.ok) {
      const events = await oddsRes.json()
      const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-z]/g, '')
      for (const ev of events) {
        const row = rows.find(
          (r) =>
            r.home_team && r.away_team &&
            ((norm(r.home_team) === norm(ev.home_team) && norm(r.away_team) === norm(ev.away_team)) ||
              (norm(r.home_team).includes(norm(ev.home_team)) && norm(r.away_team).includes(norm(ev.away_team)))),
        )
        if (!row) continue
        // медиана по букмекерам, чтобы один выброс не искажал
        const collect = (pick) => {
          const vals = (ev.bookmakers ?? [])
            .map((b) => b.markets?.find((mk) => mk.key === 'h2h')?.outcomes?.find(pick)?.price)
            .filter((x) => typeof x === 'number')
            .sort((x, y) => x - y)
          return vals.length ? vals[Math.floor(vals.length / 2)] : null
        }
        row.odds_home = collect((o) => o.name === ev.home_team)
        row.odds_away = collect((o) => o.name === ev.away_team)
        row.odds_draw = collect((o) => o.name === 'Draw')
        if (row.odds_home) oddsApplied++
      }
    } else {
      console.warn(`The Odds API: HTTP ${oddsRes.status} — коэффициенты пропущены`)
    }
  } catch (e) {
    console.warn('The Odds API недоступен — коэффициенты пропущены:', e.message)
  }
}

// --- 3. Запись в Supabase (service key, мимо RLS) ---

const upRes = await fetch(`${SB_URL}/rest/v1/matches?on_conflict=id`, {
  method: 'POST',
  headers: {
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  },
  body: JSON.stringify(rows),
})
if (!upRes.ok) {
  console.error(`Supabase: HTTP ${upRes.status}`, await upRes.text())
  process.exit(1)
}

const finished = rows.filter((r) => r.status === 'FINISHED').length
console.log(
  `OK: матчей ${rows.length}, завершённых ${finished}` +
    (ODDS_KEY ? `, с коэффициентами ${oddsApplied}` : ''),
)
