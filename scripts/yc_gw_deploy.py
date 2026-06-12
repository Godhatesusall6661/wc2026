# Деплой API Gateway в Yandex Cloud — прокси к Supabase (stdlib only).
# Шлюз форвардит любой путь на Supabase и отдаёт по HTTPS. Нужны env:
# YC_OAUTH_TOKEN, SUPABASE_URL
import os, json, time, urllib.request, urllib.error

OAUTH = os.environ['YC_OAUTH_TOKEN']
FOLDER = 'b1gck715s4iacrddq1kc'
SUPA = os.environ['SUPABASE_URL'].rstrip('/')
ANON = os.environ['SUPABASE_ANON_KEY']  # публичный ключ, зашиваем в адрес шлюза
NAME = 'wc-proxy'
BASE = 'https://serverless-apigateway.api.cloud.yandex.net/apigateways/v1/apigateways'

SPEC = f"""openapi: 3.0.0
info:
  title: wc-proxy
  version: "1.0"
paths:
  /{{path+}}:
    options:
      summary: CORS preflight
      parameters:
        - name: path
          in: path
          required: true
          schema:
            type: string
      x-yc-apigateway-integration:
        type: dummy
        http_code: 204
        http_headers:
          Access-Control-Allow-Origin: "*"
          Access-Control-Allow-Methods: "POST, OPTIONS"
          Access-Control-Allow-Headers: "content-type"
        content:
          "*": ""
    x-yc-apigateway-any-method:
      summary: proxy to supabase
      parameters:
        - name: path
          in: path
          required: true
          schema:
            type: string
      x-yc-apigateway-integration:
        type: http
        url: {SUPA}/{{path}}?apikey={ANON}
"""


def api(method, url, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header('Content-Type', 'application/json')
    if token:
        r.add_header('Authorization', 'Bearer ' + token)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read() or 'null')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or 'null')


code, res = api('POST', 'https://iam.api.cloud.yandex.net/iam/v1/tokens', {'yandexPassportOauthToken': OAUTH})
assert code == 200, res
IAM = res['iamToken']
print('1. IAM ок')


def wait(op):
    oid = op['id']
    for _ in range(120):
        if op.get('done'):
            break
        time.sleep(2)
        _, op = api('GET', f'https://operation.api.cloud.yandex.net/operations/{oid}', token=IAM)
    if op.get('error'):
        raise SystemExit('ошибка операции: ' + json.dumps(op['error'], ensure_ascii=False))
    return op


# найти существующий или создать
code, res = api('GET', f'{BASE}?folderId={FOLDER}', token=IAM)
gws = [g for g in (res.get('apiGateways') or []) if g['name'] == NAME]
if gws:
    gid = gws[0]['id']
    print('2. шлюз уже есть:', gid, '— обновляю спеку')
    code, op = api('PATCH', f'{BASE}/{gid}',
                   {'updateMask': 'openapiSpec', 'openapiSpec': SPEC}, token=IAM)
    assert code == 200, op
    wait(op)
else:
    code, op = api('POST', BASE, {'folderId': FOLDER, 'name': NAME, 'openapiSpec': SPEC}, token=IAM)
    assert code == 200, op
    op = wait(op)
    gid = op['metadata']['apiGatewayId']
    print('2. шлюз создан:', gid)

code, gw = api('GET', f'{BASE}/{gid}', token=IAM)
print('3. готово. Домен шлюза:')
print('https://' + gw['domain'])
