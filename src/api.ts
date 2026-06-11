import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config'
import type { Match, Prediction, Me, LeaderRow, MatchPrediction, ChampionState, Person } from './types'

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  if (SUPABASE_URL.includes('YOUR-PROJECT')) {
    throw new Error('Сайт ещё не настроен: заполните src/config.ts (см. SETUP.md)')
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  })
  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    /* не-JSON ответ — оставляем null */
  }
  if (!res.ok) {
    throw new Error(data?.message ?? `Ошибка сервера (${res.status})`)
  }
  return data as T
}

export const api = {
  register: (name: string) => rpc<string>('register_participant', { p_name: name }),
  me: (token: string) => rpc<Me>('get_me', { p_token: token }),
  matches: () => rpc<Match[]>('get_matches'),
  myPredictions: (token: string) => rpc<Prediction[]>('get_my_predictions', { p_token: token }),
  savePrediction: (token: string, matchId: number, h: number, a: number) =>
    rpc<null>('save_prediction', { p_token: token, p_match_id: matchId, p_home: h, p_away: a }),
  matchPredictions: (matchId: number) =>
    rpc<MatchPrediction[]>('get_match_predictions', { p_match_id: matchId }),
  leaderboard: () => rpc<LeaderRow[]>('get_leaderboard'),
  championState: (token: string) => rpc<ChampionState>('get_champion_state', { p_token: token }),
  saveChampion: (token: string, team: string) =>
    rpc<null>('save_champion', { p_token: token, p_team: team }),
  adminSetResult: (
    token: string, matchId: number,
    h: number | null, a: number | null, winner: string | null, finished: boolean,
  ) =>
    rpc<null>('admin_set_result', {
      p_token: token, p_match_id: matchId,
      p_home: h, p_away: a, p_winner: winner, p_finished: finished,
    }),
  adminParticipants: (token: string) => rpc<Person[]>('admin_list_participants', { p_token: token }),
  adminDelete: (token: string, id: string) =>
    rpc<null>('admin_delete_participant', { p_token: token, p_id: id }),
}

export function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
