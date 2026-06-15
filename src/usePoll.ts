import { useCallback, useEffect, useRef, useState } from 'react'

// Авто-обновление данных: грузит сразу, потом каждые intervalMs, плюс при
// возврате на вкладку/в окно. Нужно, чтобы открытые ставки всегда были
// актуальными — если игрок поменяет прогноз до начала матча, это видно всем.
// enabled=false полностью отключает загрузку (для свёрнутых блоков).
export function usePoll<T>(loader: () => Promise<T>, intervalMs = 30000, enabled = true) {
  const [data, setData] = useState<T | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)

  // loader пересоздаётся каждый рендер — держим в ref, чтобы интервал не
  // пересоздавался, но всегда вызывал свежую версию.
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const reload = useCallback(() => {
    setRefreshing(true)
    return loaderRef.current()
      .then((d) => {
        setData(d)
        setErr(null)
        setUpdatedAt(Date.now())
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setRefreshing(false))
  }, [])

  useEffect(() => {
    if (!enabled) return
    reload()
    const id = setInterval(reload, intervalMs)
    const onVisible = () => {
      if (!document.hidden) reload()
    }
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reload, intervalMs, enabled])

  return { data, err, refreshing, updatedAt, reload }
}
