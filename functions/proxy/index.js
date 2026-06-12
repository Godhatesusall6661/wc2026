// Yandex Cloud Function — прокси к Supabase RPC.
// Браузер из РФ ходит сюда (yandexcloud, доступно), функция дёргает Supabase.
// Пробрасывает только вызовы RPC по белому списку имён — больше ничего.
const SUPABASE_URL = process.env.SUPABASE_URL
const ANON = process.env.SUPABASE_ANON_KEY

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }
  const fn = (event.queryStringParameters || {}).fn || ''
  // только наши RPC-функции, ничего лишнего проксировать нельзя
  if (!/^[a-z_]{3,40}$/.test(fn)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ message: 'bad fn' }) }
  }
  const body = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : event.body || '{}'
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${ANON}`,
        'Content-Type': 'application/json',
      },
      body,
    })
    const text = await r.text()
    return {
      statusCode: r.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: text,
    }
  } catch (e) {
    return {
      statusCode: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'proxy error: ' + String(e) }),
    }
  }
}
