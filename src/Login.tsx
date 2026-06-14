import { useState, type FormEvent } from 'react'
import { api, errText } from './api'

// Регистрация новых закрыта — все участники уже в игре. Только вход по имени.
export default function Login({ onLogin }: { onLogin: (token: string, justRegistered?: boolean) => void }) {
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const nm = name.trim()
    if (nm.length < 2) return
    setErr(null)
    setBusy(true)
    try {
      onLogin(await api.login(nm), false)
    } catch (e) {
      const msg = /не найден/i.test(errText(e))
        ? `Имя «${nm}» не найдено. Проверь, как ты записан в таблице, или напиши организатору.`
        : errText(e)
      setErr(msg)
      setBusy(false)
    }
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
          placeholder="Ваше имя"
          maxLength={30}
          autoFocus
        />
        <button type="submit" disabled={busy || name.trim().length < 2}>
          {busy ? 'Секунду…' : 'Войти'}
        </button>
      </form>
      {err && <p className="error">{err}</p>}
      <p className="hint">Впиши своё имя (как ты записан в таблице) и нажми «Войти».</p>
    </div>
  )
}
