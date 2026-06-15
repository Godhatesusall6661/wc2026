// Синхронизация ЧМ-2026 в Supabase.
//   Расписание/команды/стадии/статус ← football-data.org
//   Счёт результатов и коэффициенты       ← the-odds-api.com
// (football-data на бесплатном тарифе помечает матч FINISHED, но счёт по ЧМ НЕ отдаёт,
//  поэтому источник счёта — the-odds-api /scores.)
//
// Запуск локально:  set -a && source ~/secrets_champ26.env && set +a && npm run sync
// В CI крутится по крону (.github/workflows/sync.yml).
//
// Обязательные: FOOTBALL_DATA_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY
// Желательный:  ODDS_API_KEY (без него не будет ни счёта, ни коэффициентов)

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
const NOW = new Date().toISOString()

// приводим к одному виду названия команд, которые два API пишут по-разному
const ALIAS = {
  czechrepublic: 'czechia',
  korearepublic: 'southkorea',
  republicofkorea: 'southkorea',
  turkey: 'turkiye',
  ivorycoast: 'cotedivoire',
  usa: 'unitedstates',
  capeverdeislands: 'capeverde', // football-data зовёт «Cape Verde Islands», odds-API — «Cape Verde»
}
const norm = (s) => {
  const n = (s ?? '').toLowerCase().replace(/[^a-z]/g, '')
  return ALIAS[n] ?? n
}
const pairKey = (h, a) => `${norm(h)}|${norm(a)}`

async function upsert(rows, label) {
  if (rows.length === 0) return
  const res = await fetch(`${SB_URL}/rest/v1/matches?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    console.error(`Supabase (${label}): HTTP ${res.status}`, await res.text())
    process.exit(1)
  }
}

// --- 1. Расписание из football-data ---

const fdRes = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
  headers: { 'X-Auth-Token': FD_TOKEN },
})
if (!fdRes.ok) {
  console.error(`football-data.org: HTTP ${fdRes.status}`, await fdRes.text())
  process.exit(1)
}
const { matches } = await fdRes.json()

// мета-строки (без голов — чтобы НЕ затирать уже сохранённый счёт)
// + карта счёта от football-data, если он его всё-таки отдал
const meta = []
const fdScore = {}
for (const m of matches) {
  const s = m.score ?? {}
  let home = s.fullTime?.home ?? null
  let away = s.fullTime?.away ?? null
  // плей-офф: счёт ДО серии пенальти
  if (s.duration === 'PENALTY_SHOOTOUT' && s.regularTime) {
    home = (s.regularTime.home ?? 0) + (s.extraTime?.home ?? 0)
    away = (s.regularTime.away ?? 0) + (s.extraTime?.away ?? 0)
  }
  const winner =
    s.winner === 'HOME_TEAM' ? m.homeTeam?.name :
    s.winner === 'AWAY_TEAM' ? m.awayTeam?.name : null
  fdScore[m.id] = { home, away, winner }
  meta.push({
    id: m.id,
    stage: m.stage,
    group_name: m.group ?? null,
    kickoff: m.utcDate,
    home_team: m.homeTeam?.name ?? null,
    away_team: m.awayTeam?.name ?? null,
    status: m.status,
    odds_home: null,
    odds_draw: null,
    odds_away: null,
    updated_at: NOW,
  })
}

// --- 2. Коэффициенты и счёт из the-odds-api ---

const oddsScore = {} // pairKey -> {home, away}
let oddsApplied = 0
if (ODDS_KEY) {
  const base = 'https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup'
  // 2a. коэффициенты (h2h)
  try {
    const r = await fetch(`${base}/odds/?apiKey=${ODDS_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`)
    if (r.ok) {
      const events = await r.json()
      for (const ev of events) {
        const row = meta.find((x) => x.home_team && x.away_team &&
          (pairKey(x.home_team, x.away_team) === pairKey(ev.home_team, ev.away_team) ||
           pairKey(x.home_team, x.away_team) === pairKey(ev.away_team, ev.home_team)))
        if (!row) continue
        const med = (pick) => {
          const v = (ev.bookmakers ?? [])
            .map((b) => b.markets?.find((mk) => mk.key === 'h2h')?.outcomes?.find(pick)?.price)
            .filter((x) => typeof x === 'number').sort((x, y) => x - y)
          return v.length ? v[Math.floor(v.length / 2)] : null
        }
        row.odds_home = med((o) => norm(o.name) === norm(ev.home_team))
        row.odds_away = med((o) => norm(o.name) === norm(ev.away_team))
        row.odds_draw = med((o) => o.name === 'Draw')
        if (row.odds_home) oddsApplied++
      }
    } else {
      console.warn(`odds h2h: HTTP ${r.status}`)
    }
  } catch (e) {
    console.warn('odds h2h недоступны:', e.message)
  }
  // 2b. счёт завершённых матчей (daysFrom max 3)
  try {
    const r = await fetch(`${base}/scores/?apiKey=${ODDS_KEY}&daysFrom=3`)
    if (r.ok) {
      const events = await r.json()
      for (const ev of events) {
        if (!ev.completed || !ev.scores) continue
        const sc = {}
        for (const s of ev.scores) sc[norm(s.name)] = Number(s.score)
        const h = sc[norm(ev.home_team)]
        const a = sc[norm(ev.away_team)]
        if (Number.isFinite(h) && Number.isFinite(a)) {
          // в обе ориентации — на случай, если у источников home/away поменяны местами
          oddsScore[pairKey(ev.home_team, ev.away_team)] = { home: h, away: a }
          oddsScore[pairKey(ev.away_team, ev.home_team)] = { home: a, away: h }
        }
      }
    } else {
      console.warn(`odds scores: HTTP ${r.status}`)
    }
  } catch (e) {
    console.warn('odds scores недоступны:', e.message)
  }
}

// --- 3. Результаты: счёт от football-data, иначе от the-odds-api ---

const results = []
for (const row of meta) {
  const fd = fdScore[row.id]
  let home = fd?.home ?? null
  let away = fd?.away ?? null
  let winner = fd?.winner ?? null
  if ((home == null || away == null) && row.home_team && row.away_team) {
    const os = oddsScore[pairKey(row.home_team, row.away_team)]
    if (os) { home = os.home; away = os.away }
  }
  if (home != null && away != null) {
    // полная строка (мета + счёт): иначе upsert-INSERT падает на NOT NULL stage
    results.push({ ...row, home_goals: home, away_goals: away, winner, status: 'FINISHED' })
  }
}

// --- 4. Запись: сначала мета (всё), потом результаты (только со счётом) ---

await upsert(meta, 'meta')
await upsert(results, 'results')

console.log(
  `OK: матчей ${meta.length}, со счётом ${results.length}` +
    (ODDS_KEY ? `, с коэффициентами ${oddsApplied}` : ' (ODDS_API_KEY не задан — нет счёта и кэфов)'),
)
