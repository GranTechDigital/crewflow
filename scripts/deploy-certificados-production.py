"""Deploy isolado, executado como root no servidor existente. Sem envio ao Drake."""
import argparse, datetime, hashlib, json, os, pathlib, secrets, shutil, subprocess, time, urllib.request

BASE = pathlib.Path('/opt/projetogran')
APP = 'crewflow-app-production'

def private_write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value, encoding='utf-8')
    path.chmod(0o600)

def run(args, input=None):
    result = subprocess.run(args, input=input, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        private_write(AUDIT / 'last-command-error.log', (result.stdout + result.stderr).decode('utf-8', errors='replace'))
        raise RuntimeError('Falha em ' + args[0] + ' ' + args[1] + '; detalhes no diretorio privado da release.')
    return result.stdout.decode('utf-8')

def inspect(name):
    return json.loads(run(['docker', 'inspect', name]))[0]

def values(container):
    return dict(value.split('=', 1) for value in container['Config']['Env'])

def write_env(path, data):
    if any('\n' in str(v) or '\r' in str(v) for v in data.values()):
        raise RuntimeError('Variavel multiline nao suportada neste deploy.')
    private_write(path, '\n'.join(k + "='" + str(v).replace("'", "\\'") + "'" for k, v in data.items()) + '\n')

def ready(port, attempts=40):
    for _ in range(attempts):
        try:
            with urllib.request.urlopen('http://127.0.0.1:' + str(port) + '/login', timeout=3) as r:
                if r.status == 200:
                    return
        except Exception:
            pass
        time.sleep(1)
    raise RuntimeError('Aplicacao nao respondeu ao health check.')

def container(name, old, image, environment, canary=False):
    network = 'projetogran_crewflow-network'
    args = ['docker', 'create', '--name', name, '--network', network]
    if canary:
        args += ['--memory', '768m', '-p', '127.0.0.1:33110:3001']
    else:
        args += ['--restart', old['HostConfig']['RestartPolicy']['Name'] or 'unless-stopped']
        for alias in ['app', APP]:
            args += ['--network-alias', alias]
        for destination, bindings in old['HostConfig']['PortBindings'].items():
            for binding in bindings:
                host = binding.get('HostIp', '')
                if host == '::':
                    host = '[::]'
                args += ['-p', (host + ':' if host else '') + binding['HostPort'] + ':' + destination.split('/')[0]]
        for key, value in old['Config'].get('Labels', {}).items():
            args += ['--label', key + '=' + value]
    args += ['--label', 'crewflow.certificados.release=' + OPTIONS.release]
    for key, value in environment.items():
        args += ['-e', key + '=' + value]
    for mount in old['Mounts']:
        args += ['-v', mount['Source'] + ':' + mount['Destination'] + (':ro' if not mount['RW'] else ':rw')]
    args += ['-v', str(BASE / 'certificados-data') + ':/app/private/certificados:rw']
    log = old['HostConfig'].get('LogConfig', {})
    if log.get('Type'):
        args += ['--log-driver', log['Type']]
        for key, value in log.get('Config', {}).items():
            args += ['--log-opt', key + '=' + value]
    args += [image, 'node', 'node_modules/next/dist/bin/next', 'start', '-p', '3001']
    run(args)
    run(['docker', 'start', name])

def smoke(name):
    result = json.loads(run(['docker', 'exec', name, 'node', 'scripts/certificados-production-smoke.cjs']))
    if not result.get('ok'):
        raise RuntimeError('Smoke test nao aprovado.')
    return result

def configure_https():
    target = pathlib.Path('/usr/local/lsws/conf/vhosts/crew.granhub.com.br/vhost.conf')
    original = target.read_text(encoding='utf-8')
    private_write(AUDIT / 'crew-vhost.before.conf', original)
    if '# crew-certificados-webhook' not in original:
        snippet = '''
# crew-certificados-webhook: somente a rota autenticada de recebimento
extprocessor crewcertificates {
  type proxy
  address 127.0.0.1:3002
  maxConns 20
  initTimeout 30
  retryTimeout 0
  persistConn 1
}
context /api/integracoes/drake/documentos/webhook {
  type proxy
  handler crewcertificates
  allowBrowse 1
  addDefaultCharset off
}
'''
        target.write_text(original + snippet, encoding='utf-8')
        try:
            run(['/usr/local/lsws/bin/openlitespeed', '-t'])
            run(['/usr/local/lsws/bin/lswsctrl', 'reload'])
        except Exception:
            target.write_text(original, encoding='utf-8')
            raise
    return target, original

def deploy():
    old = inspect(APP)
    environment = values(old)
    if environment.get('DRAKE_ENVIRONMENT') != 'production' or environment.get('DRAKE_API_BASE_URL') != 'https://drake.bz':
        raise RuntimeError('Destino existente nao corresponde a producao.')
    ready(3002, 1)
    run(['docker', 'image', 'inspect', OPTIONS.image])
    private_write(AUDIT / 'app-before.json', json.dumps(old, ensure_ascii=False))
    outbox_id = inspect('crewflow-drake-outbox-worker')['Id']
    config_path = BASE / 'certificados-config.json'
    if config_path.exists():
        config = json.loads(config_path.read_text(encoding='utf-8'))
    else:
        config = {
            'DRAKE_DOCUMENT_WEBHOOK_TOKEN': secrets.token_hex(32),
            'DRAKE_DOCUMENT_URL_KEY': __import__('base64').b64encode(secrets.token_bytes(32)).decode(),
            'DRAKE_DOCUMENT_ALLOWED_HOSTS': '',
            'DRAKE_DOCUMENT_ALLOW_AZURE_BLOB': 'true',
            'DRAKE_DOCUMENT_STORAGE_DIR': '/app/private/certificados',
            'DRAKE_DOCUMENT_REPORT_NAME': '11 - Certificados dos Funcionários.csv',
            'DRAKE_DOCUMENT_REPORT_WINDOW_HOURS': '72',
        }
        private_write(config_path, json.dumps(config, ensure_ascii=False))
    # Produção recebe URLs assinadas que mudam a cada exportação. Aceita apenas
    # Azure Blob (a validação ainda bloqueia IPs/redes privadas) e processa o PRD.
    config['DRAKE_DOCUMENT_ALLOW_AZURE_BLOB'] = 'true'
    config.pop('DRAKE_DOCUMENT_CAPTURE_UNKNOWN_STORAGE', None)
    config['DRAKE_DOCUMENT_REPORT_NAME'] = '11 - Certificados dos Funcionários.csv'
    (BASE / 'certificados-data').mkdir(mode=0o700, exist_ok=True)
    (BASE / 'certificados-data').chmod(0o700)
    write_env(BASE / '.env.certificados', config)
    write_env(BASE / '.env.certificados-worker', {**{k:environment[k] for k in ['DATABASE_URL','DRAKE_ENVIRONMENT','DRAKE_TENANT_ID']}, **config})
    write_env(BASE / '.env.certificados-compose', {'CERTIFICADOS_IMAGE':OPTIONS.image})
    private_write(BASE / 'certificados-drake-endpoint.json', json.dumps({'uri':'https://crew.granhub.com.br/api/integracoes/drake/documentos/webhook','token':config['DRAKE_DOCUMENT_WEBHOOK_TOKEN']}, ensure_ascii=False))
    updated = {**environment, **config}
    preflight_args = ['docker','run','--rm','--network','projetogran_crewflow-network','-e','DATABASE_URL='+environment['DATABASE_URL'],'-e','DRAKE_ENVIRONMENT='+environment['DRAKE_ENVIRONMENT']]
    plan = run(preflight_args + [OPTIONS.image,'node','scripts/certificados-production-preflight.cjs'])
    private_write(AUDIT / 'preflight.json', plan)
    print('PREFLIGHT_OK', flush=True)
    backup = AUDIT / 'database-before.dump'
    with backup.open('wb') as output:
        result = subprocess.run(['docker','exec','postgres-prod','sh','-c','export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc'], stdout=output, stderr=subprocess.PIPE)
    backup.chmod(0o600)
    if result.returncode or backup.stat().st_size == 0:
        raise RuntimeError('Backup nao concluido.')
    with backup.open('rb') as source:
        check = subprocess.run(['docker','exec','-i','postgres-prod','pg_restore','--file=/dev/null'], stdin=source, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if check.returncode:
        raise RuntimeError('Backup nao validado.')
    print('BACKUP_VALIDADO', flush=True)
    migration = run(preflight_args + [OPTIONS.image,'node','node_modules/prisma/build/index.js','migrate','deploy'])
    private_write(AUDIT / 'migrations.log', migration)
    print('MIGRACOES_OK', flush=True)
    canary = 'crewflow-certificados-canary-' + OPTIONS.release
    container(canary, old, OPTIONS.image, updated, True)
    ready(33110)
    private_write(AUDIT / 'canary-smoke.json', json.dumps(smoke(canary)))
    print('CANARY_OK', flush=True)
    run(['docker','stop','--time','20',canary])
    rollback = APP + '-before-' + OPTIONS.release
    promoted = False
    try:
        run(['docker','stop','--time','30',APP])
        run(['docker','rename',APP,rollback])
        promoted = True
        container(APP, old, OPTIONS.image, updated)
        ready(3002)
        smoke(APP)
        actual = values(inspect(APP))
        preserved = [k for k in environment if k.startswith('DRAKE_') or k in ['JWT_SECRET','DATABASE_URL']]
        if any(actual.get(k) != environment[k] for k in preserved):
            raise RuntimeError('Configuracao existente nao preservada.')
        if inspect('crewflow-drake-outbox-worker')['Id'] != outbox_id:
            raise RuntimeError('Worker existente foi alterado.')
        shutil.copy2(pathlib.Path(__file__).resolve().parent.parent/'docker-compose.certificados.yml', BASE/'docker-compose.certificados.yml')
        run(['docker','compose','-p','crewflow-certificados','--env-file',str(BASE/'.env.certificados-compose'),'-f',str(BASE/'docker-compose.certificados.yml'),'up','-d','--no-deps'])
        tls, original = configure_https()
        # A configuração e a autenticação completa são verificadas internamente; publicamente sem token deve retornar 401.
        code = run(['curl','-sS','-o','/dev/null','-w','%{http_code}','--max-time','15','-X','POST','-H','Content-Type: application/json','-d','{}','https://crew.granhub.com.br/api/integracoes/drake/documentos/webhook']).strip()
        if code != '401':
            tls.write_text(original, encoding='utf-8')
            run(['/usr/local/lsws/bin/lswsctrl','reload'])
            raise RuntimeError('Rota HTTPS nao aprovada: '+code)
        private_write(AUDIT/'deployment.json',json.dumps({'ok':True,'image':OPTIONS.image,'previousImage':old['Image'],'backup':str(backup),'preservedCredentials':True,'unchangedOutbox':True,'webhookUnauthenticated':code,'rollbackContainer':rollback}))
        print('DEPLOY_OK_CREDENCIAIS_PRESERVADAS_OUTBOX_INTACTA', flush=True)
    except Exception:
        if promoted:
            current = subprocess.run(['docker','inspect',APP],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            if current.returncode == 0:
                run(['docker','stop','--time','20',APP])
                run(['docker','rename',APP,APP+'-failed-'+OPTIONS.release])
            run(['docker','rename',rollback,APP])
            run(['docker','start',APP])
            ready(3002)
            print('APP_REVERTIDO_PARA_IMAGEM_ANTERIOR', flush=True)
        raise

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--image',required=True)
    parser.add_argument('--release',required=True)
    parser.add_argument('--execute',action='store_true')
    OPTIONS=parser.parse_args()
    if not OPTIONS.execute or not __import__('re').fullmatch(r'[a-zA-Z0-9-]{1,40}',OPTIONS.release):
        raise SystemExit('Exige --execute e identificador de release valido.')
    AUDIT=pathlib.Path('/var/backups/projetogran/certificados')/OPTIONS.release
    AUDIT.mkdir(parents=True,exist_ok=False,mode=0o700)
    try:
        deploy()
    except Exception as error:
        print(str(error),flush=True)
        raise SystemExit(1)
