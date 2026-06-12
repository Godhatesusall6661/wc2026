# Деплой функции-прокси в Yandex Cloud Functions (только stdlib).
# Нужны env: YC_OAUTH_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY
import os, json, base64, io, zipfile, time, urllib.request, urllib.error

OAUTH = os.environ['YC_OAUTH_TOKEN']
FOLDER = 'b1gck715s4iacrddq1kc'
SUPABASE_URL = os.environ['SUPABASE_URL']
ANON = os.environ['SUPABASE_ANON_KEY']
FN_NAME = 'wc-proxy'
FBASE = 'https://serverless-functions.api.cloud.yandex.net/functions/v1'
HERE = os.path.dirname(__file__)


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


# 1. IAM token
code, res = api('POST', 'https://iam.api.cloud.yandex.net/iam/v1/tokens', {'yandexPassportOauthToken': OAUTH})
assert code == 200, res
IAM = res['iamToken']
print('1. IAM-токен ок')


def wait(op):
    oid = op['id']
    for _ in range(120):
        if op.get('done'):
            break
        time.sleep(2)
        _, op = api('GET', f'https://operation.api.cloud.yandex.net/operations/{oid}', token=IAM)
    if op.get('error'):
        raise SystemExit('operation error: ' + json.dumps(op['error'], ensure_ascii=False))
    return op


# 2. find or create function
code, res = api('GET', f'{FBASE}/functions?folderId={FOLDER}', token=IAM)
fns = [f for f in (res.get('functions') or []) if f['name'] == FN_NAME]
if fns:
    fid = fns[0]['id']
    print('2. функция уже есть:', fid)
else:
    code, op = api('POST', f'{FBASE}/functions', {'folderId': FOLDER, 'name': FN_NAME,
                   'description': 'Прокси к Supabase для доступа из РФ'}, token=IAM)
    assert code == 200, op
    op = wait(op)
    fid = op['metadata']['functionId']
    print('2. функция создана:', fid)

# 3. zip с кодом
buf = io.BytesIO()
with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
    z.write(os.path.join(HERE, '..', 'functions', 'proxy', 'index.js'), 'index.js')
content = base64.b64encode(buf.getvalue()).decode()

# 4. версия
ver = {
    'functionId': fid, 'runtime': 'nodejs18', 'entrypoint': 'index.handler',
    'resources': {'memory': str(128 * 1024 * 1024)}, 'executionTimeout': '30s',
    'environment': {'SUPABASE_URL': SUPABASE_URL, 'SUPABASE_ANON_KEY': ANON},
    'content': content,
}
code, op = api('POST', f'{FBASE}/versions', ver, token=IAM)
assert code == 200, op
wait(op)
print('3. версия задеплоена')

# 5. публичный вызов (allUsers)
code, op = api('POST', f'{FBASE}/functions/{fid}:setAccessBindings',
               {'accessBindings': [{'roleId': 'functions.functionInvoker',
                'subject': {'id': 'allUsers', 'type': 'system'}}]}, token=IAM)
assert code == 200, op
wait(op)
print('4. публичный доступ выдан')

print('\nURL функции: https://functions.yandexcloud.net/' + fid)
