import { useEffect, useState } from 'react'
import { api } from './api'
import type { Me } from './types'
import Login from './Login'
import Matches from './Matches'
import Leaders from './Leaders'
import Champion from './Champion'
import Rules from './Rules'
import Admin from './Admin'
import Welcome from './Welcome'
import Groups from './Groups'

const TOKEN_KEY = 'wc2026_token'

// Личная ссылка вида https://site/#t=<uuid> — вход без пароля
function readTokenFromHash(): string | null {
  const m = location.hash.match(/[#&]t=([0-9a-f-]{36})/i)
  if (!m) return null
  history.replaceState(null, '', location.pathname + location.search)
  return m[1]
}

type Tab = 'matches' | 'groups' | 'leaders' | 'champion' | 'rules' | 'admin'

export default function App() {
  const [token, setToken] = useState<string | null>(() => {
    const fromHash = readTokenFromHash()
    if (fromHash) localStorage.setItem(TOKEN_KEY, fromHash)
    return fromHash ?? localStorage.getItem(TOKEN_KEY)
  })
  const [me, setMe] = useState<Me | null>(null)
  const [checking, setChecking] = useState(!!token)
  const [tab, setTab] = useState<Tab>('matches')
  const [justRegistered, setJustRegistered] = useState(false)

  useEffect(() => {
    if (!token) return
    setChecking(true)
    api
      .me(token)
      .then(setMe)
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
        setMe(null)
      })
      .finally(() => setChecking(false))
  }, [token])

  if (checking) return <div className="screen-msg">Загрузка…</div>
  if (!token || !me) {
    return (
      <Login
        onLogin={(t, justReg) => {
          localStorage.setItem(TOKEN_KEY, t)
          if (justReg) setJustRegistered(true)
          setToken(t)
        }}
      />
    )
  }

  const personalLink = `${location.origin}${location.pathname}#t=${token}`

  function logout() {
    if (
      !confirm(
        'Выйти из профиля «' + me!.name + '»?\n\n' +
          'Чтобы вернуться, понадобится личная ссылка (кнопка 🔗). ' +
          'Если не сохранили — её выдаст администратор.',
      )
    )
      return
    localStorage.removeItem(TOKEN_KEY)
    setMe(null)
    setToken(null)
    setTab('matches')
  }

  return (
    <div className="app">
      {justRegistered && (
        <Welcome name={me.name} link={personalLink} onClose={() => setJustRegistered(false)} />
      )}
      <header className="topbar">
        <span className="logo">⚽ ЧМ-2026</span>
        <span className="spacer" />
        <span className="username">{me.name}</span>
        <button
          className="link-btn"
          title="Скопировать личную ссылку для входа"
          onClick={() =>
            navigator.clipboard
              .writeText(personalLink)
              .then(() => alert('Личная ссылка скопирована.\nСохраните её — по ней вход с любого устройства.'))
          }
        >
          🔗
        </button>
        <button className="link-btn" title="Выйти / сменить игрока" onClick={logout}>
          Выйти
        </button>
      </header>
      <main className="content">
        {tab === 'matches' && <Matches token={token} />}
        {tab === 'groups' && <Groups />}
        {tab === 'leaders' && <Leaders />}
        {tab === 'champion' && <Champion token={token} />}
        {tab === 'rules' && <Rules />}
        {tab === 'admin' && me.is_admin && <Admin token={token} />}
      </main>
      <nav className="tabs">
        <button className={tab === 'matches' ? 'on' : ''} onClick={() => setTab('matches')}>Матчи</button>
        <button className={tab === 'groups' ? 'on' : ''} onClick={() => setTab('groups')}>Группы</button>
        <button className={tab === 'leaders' ? 'on' : ''} onClick={() => setTab('leaders')}>Таблица</button>
        <button className={tab === 'champion' ? 'on' : ''} onClick={() => setTab('champion')}>Чемпион</button>
        <button className={tab === 'rules' ? 'on' : ''} onClick={() => setTab('rules')}>Правила</button>
        {me.is_admin && (
          <button className={tab === 'admin' ? 'on' : ''} onClick={() => setTab('admin')}>Админ</button>
        )}
      </nav>
    </div>
  )
}
