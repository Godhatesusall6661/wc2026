export type Match = {
  id: number
  stage: string
  group_name: string | null
  kickoff: string
  home_team: string | null
  away_team: string | null
  status: string
  home_goals: number | null
  away_goals: number | null
  winner: string | null
  odds_home: number | null
  odds_draw: number | null
  odds_away: number | null
}

export type Prediction = {
  match_id: number
  home_goals: number
  away_goals: number
}

export type Me = {
  name: string
  is_admin: boolean
}

export type LeaderRow = {
  name: string
  match_points: number
  champion_team: string | null
  champion_points: number
  exact_hits: number
  total: number
}

export type MatchPrediction = {
  name: string
  home_goals: number
  away_goals: number
  points: number | null
}

export type ChampionState = {
  deadline: string | null
  teams: string[]
  my_pick: string | null
  picks: { name: string; team: string }[] | null
}

export type GridRow = {
  match_id: number
  stage: string
  group_name: string | null
  kickoff: string
  home_team: string | null
  away_team: string | null
  status: string
  home_goals: number | null
  away_goals: number | null
  participant: string
  pred_home: number
  pred_away: number
  points: number | null
}

export type Person = {
  id: string
  name: string
  token: string
  is_admin: boolean
}
