-- ============================================================
-- Прогнозист ЧМ-2026 — вся база одним скриптом.
-- Запуск: Supabase → SQL Editor → New query → вставить → Run.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Таблицы ----------

create table if not exists participants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  token      uuid not null unique default gen_random_uuid(),
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists participants_name_uniq on participants (lower(name));

create table if not exists matches (
  id         bigint primary key,            -- id матча в football-data.org
  stage      text not null,                 -- GROUP_STAGE / LAST_32 / ... / FINAL
  group_name text,
  kickoff    timestamptz not null,
  home_team  text,                          -- null, пока пара не определилась
  away_team  text,
  status     text not null default 'SCHEDULED',
  home_goals int,                           -- счёт ДО серии пенальти
  away_goals int,
  winner     text,                          -- кто прошёл дальше (уже с учётом пенальти)
  odds_home  numeric(6,2),
  odds_draw  numeric(6,2),
  odds_away  numeric(6,2),
  updated_at timestamptz not null default now()
);

create table if not exists predictions (
  participant_id uuid   not null references participants(id) on delete cascade,
  match_id       bigint not null references matches(id) on delete cascade,
  home_goals     int not null check (home_goals between 0 and 99),
  away_goals     int not null check (away_goals between 0 and 99),
  updated_at     timestamptz not null default now(),
  primary key (participant_id, match_id)
);

create table if not exists champion_picks (
  participant_id uuid primary key references participants(id) on delete cascade,
  team           text not null,
  updated_at     timestamptz not null default now()
);

-- Прямой доступ через API закрыт: RLS без политик.
-- Чтение/запись — только через функции security definer ниже
-- (и service key из скрипта синхронизации).
alter table participants   enable row level security;
alter table matches        enable row level security;
alter table predictions    enable row level security;
alter table champion_picks enable row level security;

-- ---------- Подсчёт очков (единственное место с правилами) ----------
-- 1) угадан исход                          +3
-- 2) угадана разница мячей точно           +4, ошибка в 1 мяч +2
-- 3) полностью угадан счёт                 +3
-- 4) бонус: угадана разница >= 3 мячей     +1
-- Пункты суммируются, максимум 11.
-- ВНИМАНИЕ: +2 за «ошибку в 1 мяч» даётся и при неугаданном исходе
-- (буквальное чтение правил). Если организатор считает иначе —
-- дописать ко второму when условие: and sign(ph - pa) = sign(rh - ra)

create or replace function match_points(ph int, pa int, rh int, ra int)
returns int
language sql immutable
as $$
  select case
    when ph is null or pa is null or rh is null or ra is null then 0
    else
      (case when sign(ph - pa) = sign(rh - ra) then 3 else 0 end)
    + (case when (ph - pa) = (rh - ra) then 4
            when abs((ph - pa) - (rh - ra)) = 1 then 2
            else 0 end)
    + (case when ph = rh and pa = ra then 3 else 0 end)
    + (case when (ph - pa) = (rh - ra) and abs(rh - ra) >= 3 then 1 else 0 end)
  end
$$;

-- ---------- Служебные ----------

create or replace function _participant(p_token uuid)
returns participants
language plpgsql stable security definer set search_path = public
as $$
declare v participants;
begin
  select * into v from participants where token = p_token;
  if not found then
    raise exception 'Игрок не найден — войдите заново';
  end if;
  return v;
end $$;

create or replace function _admin(p_token uuid)
returns participants
language plpgsql stable security definer set search_path = public
as $$
declare v participants := _participant(p_token);
begin
  if not v.is_admin then
    raise exception 'Только для администратора';
  end if;
  return v;
end $$;

-- Дедлайн выбора чемпиона = старт первого четвертьфинала
create or replace function _qf_deadline()
returns timestamptz
language sql stable security definer set search_path = public
as $$
  select min(kickoff) from matches where stage = 'QUARTER_FINALS'
$$;

-- ---------- RPC для сайта ----------

create or replace function register_participant(p_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_name  text := btrim(p_name);
  v_token uuid;
begin
  if v_name is null or length(v_name) < 2 or length(v_name) > 30 then
    raise exception 'Имя должно быть от 2 до 30 символов';
  end if;
  begin
    insert into participants (name) values (v_name) returning token into v_token;
  exception when unique_violation then
    raise exception 'Имя «%» уже занято. Если это вы — откройте свою личную ссылку.', v_name;
  end;
  return v_token;
end $$;

-- Вход по имени: возвращает токен существующего игрока.
-- ВНИМАНИЕ: знающий имя получает полный доступ к профилю (без пин-кода).
create or replace function login_by_name(p_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_token uuid;
begin
  select token into v_token from participants where lower(name) = lower(btrim(p_name));
  if not found then
    raise exception 'Игрок «%» не найден. Проверьте имя или зарегистрируйтесь.', btrim(p_name);
  end if;
  return v_token;
end $$;

create or replace function get_me(p_token uuid)
returns json
language plpgsql stable security definer set search_path = public
as $$
declare v participants := _participant(p_token);
begin
  return json_build_object('name', v.name, 'is_admin', v.is_admin);
end $$;

create or replace function get_matches()
returns setof matches
language sql stable security definer set search_path = public
as $$
  select * from matches order by kickoff, id
$$;

create or replace function get_my_predictions(p_token uuid)
returns table (match_id bigint, home_goals int, away_goals int)
language plpgsql stable security definer set search_path = public
as $$
declare v participants := _participant(p_token);
begin
  return query
    select p.match_id, p.home_goals, p.away_goals
    from predictions p
    where p.participant_id = v.id;
end $$;

create or replace function save_prediction(p_token uuid, p_match_id bigint, p_home int, p_away int)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v participants := _participant(p_token);
  m matches;
begin
  select * into m from matches where id = p_match_id;
  if not found then
    raise exception 'Матч не найден';
  end if;
  if m.home_team is null or m.away_team is null then
    raise exception 'Пара ещё не определена';
  end if;
  if m.kickoff <= now() then
    raise exception 'Матч уже начался — прогноз менять нельзя';
  end if;
  if p_home is null or p_away is null
     or p_home not between 0 and 99 or p_away not between 0 and 99 then
    raise exception 'Счёт должен быть числом от 0 до 99';
  end if;
  insert into predictions (participant_id, match_id, home_goals, away_goals)
  values (v.id, p_match_id, p_home, p_away)
  on conflict (participant_id, match_id) do update
    set home_goals = excluded.home_goals,
        away_goals = excluded.away_goals,
        updated_at = now();
end $$;

-- Прогнозы всех по матчу — только после начала, чтобы нельзя было списать
create or replace function get_match_predictions(p_match_id bigint)
returns table (name text, home_goals int, away_goals int, points int)
language plpgsql stable security definer set search_path = public
as $$
declare m matches;
begin
  select * into m from matches where id = p_match_id;
  if not found then
    raise exception 'Матч не найден';
  end if;
  if m.kickoff > now() then
    raise exception 'Чужие прогнозы откроются после начала матча';
  end if;
  return query
    select pa.name, p.home_goals, p.away_goals,
           case when m.status = 'FINISHED'
                then match_points(p.home_goals, p.away_goals, m.home_goals, m.away_goals)
                else null end
    from predictions p
    join participants pa on pa.id = p.participant_id
    where p.match_id = p_match_id
    order by pa.name;
end $$;

create or replace function get_leaderboard()
returns table (
  name            text,
  match_points    int,
  champion_team   text,
  champion_points int,
  exact_hits      int,
  total           int
)
language sql stable security definer set search_path = public
as $$
  with finished as (
    select * from matches
    where status = 'FINISHED' and home_goals is not null and away_goals is not null
  ),
  pts as (
    select p.participant_id,
           sum(match_points(p.home_goals, p.away_goals, f.home_goals, f.away_goals))::int as mp,
           (count(*) filter (where p.home_goals = f.home_goals and p.away_goals = f.away_goals))::int as ex
    from predictions p
    join finished f on f.id = p.match_id
    group by p.participant_id
  ),
  champ as (
    -- +5 за победу выбранной команды в полуфинале и +5 в финале
    select c.participant_id, c.team,
           (5 * (select count(*) from finished f
                 where f.stage in ('SEMI_FINALS', 'FINAL') and f.winner = c.team))::int as cp
    from champion_picks c
  )
  select pa.name,
         coalesce(pts.mp, 0),
         -- чьи выборы чемпиона — секрет до дедлайна 1/4
         case when _qf_deadline() is not null and now() >= _qf_deadline() then champ.team end,
         coalesce(champ.cp, 0),
         coalesce(pts.ex, 0),
         coalesce(pts.mp, 0) + coalesce(champ.cp, 0)
  from participants pa
  left join pts   on pts.participant_id   = pa.id
  left join champ on champ.participant_id = pa.id
  order by 6 desc, 5 desc, 1
$$;

-- Общая «сетка»: прогнозы всех на все НАЧАВШИЕСЯ матчи (до старта — скрыто).
-- Клиент строит из этого две матрицы: групповой этап и плей-офф.
create or replace function get_grid()
returns table (
  match_id    bigint,
  stage       text,
  group_name  text,
  kickoff     timestamptz,
  home_team   text,
  away_team   text,
  status      text,
  home_goals  int,
  away_goals  int,
  participant text,
  pred_home   int,
  pred_away   int,
  points      int
)
language sql stable security definer set search_path = public
as $$
  select m.id, m.stage, m.group_name, m.kickoff, m.home_team, m.away_team, m.status,
         m.home_goals, m.away_goals,
         pa.name, p.home_goals, p.away_goals,
         case when m.status = 'FINISHED'
              then match_points(p.home_goals, p.away_goals, m.home_goals, m.away_goals)
              else null end
  from matches m
  join predictions p   on p.match_id = m.id
  join participants pa on pa.id = p.participant_id
  where m.kickoff <= now()
  order by m.kickoff, m.id, pa.name
$$;

create or replace function get_champion_state(p_token uuid)
returns json
language plpgsql stable security definer set search_path = public
as $$
declare
  v          participants := _participant(p_token);
  v_deadline timestamptz  := _qf_deadline();
  v_teams    text[];
  v_my       text;
  v_picks    json;
begin
  select coalesce(array_agg(distinct t order by t), '{}'::text[]) into v_teams
  from (
    select home_team as t from matches where stage = 'QUARTER_FINALS' and home_team is not null
    union
    select away_team from matches where stage = 'QUARTER_FINALS' and away_team is not null
  ) s;

  select team into v_my from champion_picks where participant_id = v.id;

  if v_deadline is not null and now() >= v_deadline then
    select coalesce(json_agg(json_build_object('name', pa.name, 'team', c.team) order by pa.name), '[]'::json)
    into v_picks
    from champion_picks c
    join participants pa on pa.id = c.participant_id;
  end if;

  return json_build_object(
    'deadline', v_deadline,
    'teams',    to_json(v_teams),
    'my_pick',  v_my,
    'picks',    v_picks
  );
end $$;

create or replace function save_champion(p_token uuid, p_team text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v          participants := _participant(p_token);
  v_deadline timestamptz  := _qf_deadline();
begin
  if v_deadline is null then
    raise exception 'Сетка 1/4 финала ещё не загружена';
  end if;
  if now() >= v_deadline then
    raise exception 'Выбор закрыт — четвертьфиналы уже начались';
  end if;
  if not exists (
    select 1 from matches
    where stage = 'QUARTER_FINALS' and (home_team = p_team or away_team = p_team)
  ) then
    raise exception 'Выбрать можно только участника 1/4 финала';
  end if;
  insert into champion_picks (participant_id, team) values (v.id, p_team)
  on conflict (participant_id) do update
    set team = excluded.team, updated_at = now();
end $$;

-- ---------- RPC для администратора ----------

create or replace function admin_set_result(
  p_token uuid, p_match_id bigint,
  p_home int, p_away int, p_winner text, p_finished boolean
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform _admin(p_token);
  update matches
     set home_goals = p_home,
         away_goals = p_away,
         winner     = nullif(btrim(coalesce(p_winner, '')), ''),
         status     = case when p_finished then 'FINISHED' else status end,
         updated_at = now()
   where id = p_match_id;
  if not found then
    raise exception 'Матч не найден';
  end if;
end $$;

create or replace function admin_list_participants(p_token uuid)
returns table (id uuid, name text, token uuid, is_admin boolean)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform _admin(p_token);
  return query
    select pa.id, pa.name, pa.token, pa.is_admin
    from participants pa
    order by pa.created_at;
end $$;

create or replace function admin_delete_participant(p_token uuid, p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v participants := _admin(p_token);
begin
  if p_id = v.id then
    raise exception 'Нельзя удалить самого себя';
  end if;
  delete from participants where id = p_id;
end $$;

-- ============================================================
-- После первого захода на сайт назначить админов (себя и отца):
--   update participants set is_admin = true where name in ('Имя1', 'Имя2');
--
-- Проверка правил очков (все должны вернуть true):
--   select match_points(2,0,2,0) = 10;  -- исход+разница+точный счёт
--   select match_points(1,0,2,0) = 5;   -- исход + разница с ошибкой в 1
--   select match_points(3,0,4,1) = 8;   -- исход + разница + бонус >=3
--   select match_points(1,1,0,0) = 7;   -- ничья + разница 0 точно
--   select match_points(0,3,1,4) = 8;   -- гостевой разгром + бонус
-- ============================================================
