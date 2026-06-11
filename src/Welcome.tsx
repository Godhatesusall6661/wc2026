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
          По этой ссылке вы попадёте прямо в свой профиль на любом телефоне в один тап — удобно
          сохранить. А если потеряете — ничего страшного: на входе можно просто ввести своё имя.
        </p>
        <button className="ghost wide" onClick={onClose}>
          {copied ? 'Сохранил(а), продолжить →' : 'Понятно, продолжить →'}
        </button>
      </div>
    </div>
  )
}
