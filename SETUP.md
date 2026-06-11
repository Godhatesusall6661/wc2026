# Запуск с нуля — пошагово

Понадобятся бесплатные аккаунты: **GitHub**, **Supabase**, **football-data.org**
(опционально **the-odds-api.com** для коэффициентов). На всё ~30 минут.

## 1. Supabase (база данных)

1. [supabase.com](https://supabase.com) → New project (регион Frankfurt/EU, имя любое).
2. Слева **SQL Editor** → New query → вставить целиком содержимое
   `supabase/schema.sql` → **Run**. Должно завершиться без ошибок.
3. **Project Settings → API**, скопировать три значения:
   - **Project URL** (вида `https://xxxx.supabase.co`)
   - ключ **anon / public** — пойдёт в `src/config.ts` (он публичный, это нормально)
   - ключ **service_role** — секретный, только в `~/secrets.env` и GitHub Secrets

## 2. Токен расписания и результатов

1. [football-data.org/client/register](https://www.football-data.org/client/register) —
   бесплатная регистрация, токен придёт на почту.
2. (Опционально) [the-odds-api.com](https://the-odds-api.com) — бесплатный ключ
   на 500 запросов/мес, для коэффициентов букмекеров. Можно пропустить и добавить потом.

## 3. Локальная проверка

Дописать в `~/secrets_champ26.env` (файл редактировать руками, не через echo):

```
FOOTBALL_DATA_TOKEN=...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=...
ODDS_API_KEY=...        # опционально
```

Затем из папки проекта:

```bash
source ~/secrets_champ26.env
npm run sync
```

Ожидаемый вывод: `OK: матчей 104, завершённых N`. Это значит, расписание в базе.

> Если football-data вернул 403 на /WC — у бесплатного тарифа не оказалось ЧМ-2026.
> Скажи об этом Claude — переключим источник на API-Football, правка только в `scripts/sync.mjs`.

## 4. Конфиг фронтенда

В `src/config.ts` вписать Project URL и **anon**-ключ из шага 1.3.

## 5. GitHub: репозиторий, секреты, сайт

1. Создать **публичный** репозиторий `wc2026` (Pages бесплатен только для публичных).
2. Из папки проекта:
   ```bash
   git init && git add -A && git commit -m "Конкурс прогнозистов ЧМ-2026"
   git branch -M main
   git remote add origin git@github.com:<логин>/wc2026.git
   git push -u origin main
   ```
3. В репозитории **Settings → Secrets and variables → Actions** → добавить секреты:
   `FOOTBALL_DATA_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (+ `ODDS_API_KEY` если есть).
4. **Settings → Pages** → Source: **GitHub Actions**.
5. Вкладка **Actions**: workflow «Deploy site» запустится сам после push
   (или запустить вручную). Сайт появится на `https://<логин>.github.io/wc2026/`.
6. Там же вручную запустить «Sync results» один раз и убедиться, что он зелёный.
   Дальше он сам ходит каждые 20 минут.

## 6. Назначить админов

1. Открыть сайт, зарегистрироваться под своим именем (и попросить отца).
2. В Supabase → SQL Editor:
   ```sql
   update participants set is_admin = true where name in ('ТвоёИмя', 'ИмяОтца');
   ```
3. После перезахода на сайт появится вкладка «Админ».

## 7. Запуск конкурса

Кинуть ссылку на сайт в чат. Каждый сам регистрируется по имени и ставит прогнозы.

## Если что-то пошло не так

- **Игрок потерял вход** → Админ → Игроки → «🔗 ссылка» → отправить ему лично.
- **Результат в базе неверный** → Админ → Результаты матчей → поправить руками
  (счёт до пенальти; «прошёл дальше» — с учётом пенальти).
- **Сайт пишет «не настроен»** → не заполнен `src/config.ts` (шаг 4) или не задеплоен после правки.
- **Синк красный в Actions** → открыть лог шага `node scripts/sync.mjs`, там понятная ошибка
  (чаще всего не добавлен секрет из шага 5.3).
