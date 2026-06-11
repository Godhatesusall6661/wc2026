import { useState } from 'react'

// Показывается сразу после регистрации. Главная задача — чтобы человек
// СОХРАНИЛ личную ссылку: по ней он вернётся в свой профиль с любого
// устройства (встроенные браузеры чатов часто сбрасывают сессию).
export default function Welcome({
  name, link, onClose,
}: {
  name: string
  link: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(link).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }

  return (
    <div className="modal-back">
      <div className="welcome" onClick={(e) => e.stopPropagation()}>
        <h2>Готово, {name} — вы в игре! ⚽</h2>
        <p className="welcome-warn">❗️ Сохраните свою ссылку для входа</p>
        <div className="link-box">{link}</div>
        <button className="primary big" onClick={copy}>
          {copied ? '✓ Скопировано' : '📋 Скопировать ссылку'}
        </button>
        <p className="welcome-why">
          Это ваш личный вход. Открывайте сайт <b>только по этой ссылке</b> — особенно если зашли
          из чата. По ней вы попадёте прямо в свой профиль на любом телефоне, ничего вводить не
          нужно. Без неё вернуться не получится.
        </p>
        <button className="ghost wide" onClick={onClose} disabled={!copied}>
          {copied ? 'Сохранил(а), продолжить →' : 'Сначала скопируйте ссылку ↑'}
        </button>
      </div>
    </div>
  )
}
