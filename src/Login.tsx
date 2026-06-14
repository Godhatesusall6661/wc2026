import { useState, useEffect, type FormEvent } from 'react'
import { api, errText } from './api'

// Расстояние Левенштейна — чтобы ловить опечатки в имени при регистрации.
function lev(a: string, b: string): number {
  a = a.toLowerCase().trim()
  b = b.toLowerCase().trim()
  const m = a.length, n = b.length
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) d[i][0] = i
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[m][n]
}

export default function Login({ onLogin }: { onLogin: (token: string, justRegistered?: boolean) => void }) {
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [names, setNames] = useState<string[]>([])
  const [pending, setPending] = useState<{ name: string; similar: string[] } | null>(null)

  useEffect(() => {
    api.leaderboard().then((rows) => setNames(rows.map((r) => r.name))).catch(() => {})
  }, [])

  async function loginAs(nm: string) {
    setErr(null)
    setBusy(true)
    try {
      onLogin(await api.login(nm), false)
    } catch (e) {
      // не нашли имя — подсказываем, что для новичков есть отдельная кнопка
      const msg = /не найден/i.test(errText(e))
        ? `Имя «${nm}» не найдено. Если ты впервые — нажми «Я впервые — создать профиль».`
        : errText(e)
      setErr(msg)
      setBusy(false)
      setPending(null)
    }
  }

  async function createNew(nm: string) {
    setErr(null)
    setBusy(true)
    try {
      onLogin(await api.register(nm), true)
    } catch (e) {
      if (/занят|exist/i.test(errText(e))) {
        try { onLogin(await api.login(nm), false); return } catch { /* ниже */ }
      }
      setErr(errText(e))
      setBusy(false)
      setPending(null)
    }
  }

  // «Войти» (для тех, кто уже играет) — основное действие, в т.ч. по Enter
  function onLoginSubmit(e: FormEvent) {
    e.preventDefault()
    const nm = name.trim()
    if (nm.length >= 2) loginAs(nm)
  }

  // «Создать профиль» — новое имя, с защитой от опечаток
  function onRegisterClick() {
    const nm = name.trim()
    if (nm.length < 2) return
    setErr(null)
    if (names.some((n) => n.toLowerCase() === nm.toLowerCase())) {
      loginAs(nm) // имя уже есть — просто впускаем
      return
    }
    const similar = names.filter((n) => lev(n, nm) <= 2).slice(0, 4)
    setPending({ name: nm, similar })
  }

  // экран подтверждения создания нового игрока
  if (pending) {
    return (
      <div className="login">
        <h1>Создать новый профиль?</h1>
        <p className="confirm-name">«{pending.name}»</p>
        {pending.similar.length > 0 ? (
          <>
            <p className="hint">Похоже на уже играющих — может, это ты, просто опечатка? Нажми на себя:</p>
            <div className="similar-list">
              {pending.similar.map((s) => (
                <button key={s} className="similar-btn" disabled={busy} onClick={() => loginAs(s)}>
                  это я — {s}
                </button>
              ))}
            </div>
            <p className="hint">или, если ты правда новенький:</p>
          </>
        ) : (
          <p className="hint">Раньше под этим именем никто не играл.</p>
        )}
        <button className="primary big" disabled={busy} onClick={() => createNew(pending.name)}>
          {busy ? 'Секунду…' : `Создать профиль «${pending.name}»`}
        </button>
        <p className="hint">
          <button type="button" className="link-inline" onClick={() => { setPending(null); setErr(null) }}>
            ← назад, исправить имя
          </button>
        </p>
        {err && <p className="error">{err}</p>}
      </div>
    )
  }

  return (
    <div className="login">
      <h1>
        ⚽ Конкурс прогнозистов
        <br />
        ЧМ-2026
      </h1>
      <form onSubmit={onLoginSubmit}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ваше имя"
          maxLength={30}
          autoFocus
        />
        <button type="submit" disabled={busy || name.trim().length < 2}>
          {busy ? 'Секунду…' : 'Войти'}
        </button>
      </form>
      <button
        type="button"
        className="login-secondary"
        disabled={busy || name.trim().length < 2}
        onClick={onRegisterClick}
      >
        Я впервые — создать профиль
      </button>
      {err && <p className="error">{err}</p>}
      <p className="hint">
        Уже играл(а) — впиши имя и жми <b>«Войти»</b>.<br />
        Первый раз — <b>«Создать профиль»</b> (лучше имя и фамилию, у нас много тёзок).
      </p>
    </div>
  )
}
