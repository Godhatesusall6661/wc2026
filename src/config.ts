// Заполнено автоматически при настройке.
// Оба значения публичные: anon key рассчитан на то, что его видно
// в браузере, доступ к данным ограничивает сама база (RLS + функции).
export const SUPABASE_URL = 'https://eephxunbabptaewgvxzy.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlcGh4dW5iYWJwdGFld2d2eHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTAzMTMsImV4cCI6MjA5Njc2NjMxM30.NrN5waXqP5ozSk6boIO-KSrviRR1wSehTfB_0IEPxic'

// Прокси через Yandex API Gateway (доступен из РФ, HTTPS). Пусто → прямой Supabase.
export const PROXY_URL = 'https://d5d99p0ioav4q6flf7q1.uvah0e6r.apigw.yandexcloud.net'

// Фиче-флаги. Включить вкладку «Чемпион» перед 1/4 финала → поставь true и задеплой.
export const FEATURES = {
  champion: false,
}
