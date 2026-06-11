import { useState } from 'react'
import Matches from './Matches'
import Groups from './Groups'

// Объединённая вкладка: матчи + турнирные таблицы групп, переключатель внутри.
export default function Schedule({ token }: { token: string }) {
  const [view, setView] = useState<'matches' | 'groups'>('matches')
  return (
    <div>
      <div className="seg">
        <button className={view === 'matches' ? 'on' : ''} onClick={() => setView('matches')}>
          Матчи
        </button>
        <button className={view === 'groups' ? 'on' : ''} onClick={() => setView('groups')}>
          Группы
        </button>
      </div>
      {view === 'matches' ? <Matches token={token} /> : <Groups />}
    </div>
  )
}
