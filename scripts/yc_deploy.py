# Деплой статики в Yandex Object Storage по S3-протоколу (AWS SigV4, только stdlib).
# Запуск: set -a; source ~/secrets_champ26.env; set +a; python3 scripts/yc_deploy.py <bucket>
import os, sys, hashlib, hmac, datetime, mimetypes, urllib.request, urllib.error

KEY = os.environ['YC_S3_KEY_ID']
SECRET = os.environ['YC_S3_SECRET']
HOST = 'storage.yandexcloud.net'
REGION = 'ru-central1'
SERVICE = 's3'
BUCKET = sys.argv[1] if len(sys.argv) > 1 else 'prognoz-wc2026'
DIST = os.path.join(os.path.dirname(__file__), '..', 'dist')

CT = {
    '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json',
    '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.map': 'application/json',
}


def sigkey(date):
    k = hmac.new(('AWS4' + SECRET).encode(), date.encode(), hashlib.sha256).digest()
    k = hmac.new(k, REGION.encode(), hashlib.sha256).digest()
    k = hmac.new(k, SERVICE.encode(), hashlib.sha256).digest()
    return hmac.new(k, b'aws4_request', hashlib.sha256).digest()


def uri_encode(s, keep_slash=False):
    out = []
    for ch in s:
        if ch.isalnum() or ch in '-._~' or (ch == '/' and keep_slash):
            out.append(ch)
        else:
            out += ['%%%02X' % b for b in ch.encode('utf-8')]
    return ''.join(out)


def req(method, key='', query=None, body=b'', content_type=None, extra=None):
    query = query or {}
    now = datetime.datetime.utcnow()
    amzdate = now.strftime('%Y%m%dT%H%M%SZ')
    datestamp = now.strftime('%Y%m%d')
    uri = '/' + BUCKET + (('/' + uri_encode(key, keep_slash=True)) if key else '')
    cq = '&'.join(uri_encode(k) + '=' + uri_encode(v) for k, v in sorted(query.items()))
    ph = hashlib.sha256(body).hexdigest()
    headers = {'host': HOST, 'x-amz-content-sha256': ph, 'x-amz-date': amzdate}
    if content_type:
        headers['content-type'] = content_type
    for h, v in (extra or {}).items():
        headers[h.lower()] = v
    signed = ';'.join(sorted(headers))
    canon_headers = ''.join(f'{h}:{headers[h]}\n' for h in sorted(headers))
    canon = '\n'.join([method, uri, cq, canon_headers, signed, ph])
    scope = f'{datestamp}/{REGION}/{SERVICE}/aws4_request'
    sts = '\n'.join(['AWS4-HMAC-SHA256', amzdate, scope, hashlib.sha256(canon.encode()).hexdigest()])
    sig = hmac.new(sigkey(datestamp), sts.encode(), hashlib.sha256).hexdigest()
    headers['Authorization'] = f'AWS4-HMAC-SHA256 Credential={KEY}/{scope}, SignedHeaders={signed}, Signature={sig}'
    url = f'https://{HOST}{uri}' + (('?' + cq) if cq else '')
    r = urllib.request.Request(url, data=body or None, method=method)
    for h, v in headers.items():
        r.add_header(h, v)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def show(label, code, body):
    ok = 200 <= code < 300
    print(f"{'OK ' if ok else 'ERR'} {label}: HTTP {code}" + ('' if ok else ' | ' + body[:300].decode('utf-8', 'replace')))
    return ok


step = sys.argv[2] if len(sys.argv) > 2 else 'all'

if step in ('create', 'all'):
    code, body = req('PUT', body=b'')
    if code == 409 and b'BucketAlreadyOwnedByYou' in body:
        print('OK  bucket: уже существует и наш')
    else:
        show('create bucket', code, body)

if step in ('public', 'all'):
    policy = ('{"Version":"2012-10-17","Statement":[{"Sid":"PublicRead","Effect":"Allow",'
              '"Principal":"*","Action":["s3:GetObject"],'
              f'"Resource":["arn:aws:s3:::{BUCKET}/*"]}}]}}').encode()
    show('bucket policy (public read)', *req('PUT', query={'policy': ''}, body=policy, content_type='application/json'))
    web = ('<?xml version="1.0" encoding="UTF-8"?>'
           '<WebsiteConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">'
           '<IndexDocument><Suffix>index.html</Suffix></IndexDocument>'
           '<ErrorDocument><Key>index.html</Key></ErrorDocument>'
           '</WebsiteConfiguration>').encode()
    show('website config', *req('PUT', query={'website': ''}, body=web, content_type='application/xml'))

if step in ('upload', 'all'):
    n = 0
    for root, _, files in os.walk(DIST):
        for f in files:
            full = os.path.join(root, f)
            key = os.path.relpath(full, DIST).replace(os.sep, '/')
            ct = CT.get(os.path.splitext(f)[1].lower()) or mimetypes.guess_type(f)[0] or 'application/octet-stream'
            with open(full, 'rb') as fh:
                data = fh.read()
            # index.html — всегда свежий (no-cache), чтобы люди не висели на старой версии;
            # ассеты с хешем в имени — кэшируем надолго.
            cache = 'no-cache' if key == 'index.html' else 'public, max-age=31536000, immutable'
            r = req('PUT', key=key, body=data, content_type=ct,
                    extra={'x-amz-acl': 'public-read', 'cache-control': cache})
            if show(f'upload {key} ({len(data)}b)', *r):
                n += 1
    print(f'--- загружено файлов: {n}')

if step == 'bucketacl':
    show('bucket ACL public-read', *req('PUT', query={'acl': ''}, extra={'x-amz-acl': 'public-read'}))

print(f'\nСайт: http://{BUCKET}.website.yandexcloud.net')
