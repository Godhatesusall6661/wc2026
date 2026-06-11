import { useState, type FormEvent } from 'react'
import { api, errText } from './api'

export default function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      const token = await api.register(name)
      alert(
        'Готово, вы в игре!\n\n' +
          'Совет: нажмите 🔗 в шапке и сохраните личную ссылку — по ней можно зайти с другого устройства.',
      )
      onLogin(token)
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
          placeholder="Ваше имя (как вас знают в чате)"
          maxLength={30}
          autoFocus
        />
        <button disabled={busy || name.trim().length < 2}>{busy ? 'Секунду…' : 'Играть!'}</button>
      </form>
      {err && <p className="error">{err}</p>}
      <p className="hint">
        Уже регистрировались? Откройте свою личную ссылку — вход произойдёт сам.
        Потеряли ссылку — попросите новую у администратора.
      </p>
    </div>
  )
}
