import { useState, useEffect, type FormEvent } from 'react'
import { api, errText } from './api'

// Расстояние Левенштейна — чтобы ловить опечатки в имени.
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
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [names, setNames] = useState<string[]>([])
  // подтверждение создания нового игрока (вдруг опечатка)
  const [pending, setPending] = useState<{ name: string; similar: string[] } | null>(null)

  // список существующих имён — для проверки на опечатку (get_leaderboard публичный)
  useEffect(() => {
    api.leaderboard().then((rows) => setNames(rows.map((r) => r.name))).catch(() => {})
  }, [])

  async function loginAs(nm: string) {
    setErr(null)
    setBusy(true)
    try {
      onLogin(await api.login(nm), false)
    } catch (e) {
      setErr(errText(e))
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
      // вдруг кто-то занял имя между проверкой и созданием — тогда просто входим
      if (/занят|exist/i.test(errText(e))) {
        try { onLogin(await api.login(nm), false); return } catch { /* ниже */ }
      }
      setErr(errText(e))
      setBusy(false)
      setPending(null)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    const nm = name.trim()
    if (mode === 'login') {
      loginAs(nm)
      return
    }
    // режим «Играть»: если имя уже есть — это возвращается свой игрок
    const exists = names.some((n) => n.toLowerCase() === nm.toLowerCase())
    if (exists) {
      loginAs(nm)
      return
    }
    // имя новое — предупреждаем (вдруг опечатка) и показываем похожие
    const similar = names.filter((n) => lev(n, nm) <= 2).slice(0, 4)
    setPending({ name: nm, similar })
  }

  if (pending) {
    return (
      <div className="login">
        <h1>Это новое имя</h1>
        <p className="confirm-name">«{pending.name}»</p>
        {pending.similar.length > 0 ? (
          <>
            <p className="hint">Похоже на уже играющих — может, опечатка? Выбери себя:</p>
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
          <p className="hint">Раньше под этим именем никто не играл — создать нового игрока?</p>
        )}
        <button className="primary big" disabled={busy} onClick={() => createNew(pending.name)}>
          {busy ? 'Секунду…' : `Я новенький — создать «${pending.name}»`}
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
      <form onSubmit={submit}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={mode === 'register' ? 'Ваше имя (как вас знают в чате)' : 'Ваше имя'}
          maxLength={30}
          autoFocus
        />
        <button disabled={busy || name.trim().length < 2}>
          {busy ? 'Секунду…' : mode === 'register' ? 'Играть!' : 'Войти'}
        </button>
      </form>
      {err && <p className="error">{err}</p>}
      <p className="hint">
        {mode === 'register' ? (
          <>
            Уже играли?{' '}
            <button type="button" className="link-inline" onClick={() => { setMode('login'); setErr(null) }}>
              Войти по имени
            </button>
          </>
        ) : (
          <>
            Первый раз тут?{' '}
            <button type="button" className="link-inline" onClick={() => { setMode('register'); setErr(null) }}>
              Зарегистрироваться
            </button>
          </>
        )}
      </p>
    </div>
  )
}
