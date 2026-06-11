import { useState, type FormEvent } from 'react'
import { api, errText } from './api'

export default function Login({ onLogin }: { onLogin: (token: string, justRegistered?: boolean) => void }) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      if (mode === 'register') {
        const token = await api.register(name)
        onLogin(token, true)
      } else {
        const token = await api.login(name)
        onLogin(token, false)
      }
    } catch (e) {
      setErr(errText(e))
    } finally {
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
