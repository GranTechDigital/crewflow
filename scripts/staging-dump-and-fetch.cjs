const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getEnv(name, def = '') { return process.env[name] || def; }
function run(cmd, opts = {}) { console.log('> ' + cmd); execSync(cmd, { stdio: 'inherit', ...opts }); }

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function main() {
  const STAGING_SSH_HOST = getEnv('STAGING_SSH_HOST') || getEnv('SERVER_HOST') || getEnv('PROD_SERVER_HOST');
  const STAGING_SSH_USER = getEnv('STAGING_SSH_USER', 'root');
  const STAGING_SSH_PORT = getEnv('STAGING_SSH_PORT', getEnv('PROD_SERVER_SSH_PORT', '22'));
  const STAGING_SSH_KEY_PATH = getEnv('STAGING_SSH_KEY_PATH', getEnv('PROD_SSH_KEY_PATH', ''));
  const STAGING_BACKUP_DIR = getEnv('STAGING_BACKUP_DIR', '/var/backups/projetogran/staging');
  const LOCAL_BACKUP_DIR = getEnv('LOCAL_BACKUP_DIR', path.resolve(process.cwd(), 'backups'));
  const PG_CONTAINER_NAME = getEnv('PG_CONTAINER_NAME', 'postgres-staging');

  if (!STAGING_SSH_HOST) {
    console.error('STAGING_SSH_HOST não definido. Configure STAGING_SSH_* (ou SERVER_HOST) e tente novamente.');
    process.exit(1);
  }
  ensureDir(LOCAL_BACKUP_DIR);

  const tsCmd = "date -u +%Y%m%d_%H%M%S";
  const sshBase = `ssh -o StrictHostKeyChecking=no -p ${STAGING_SSH_PORT} ${STAGING_SSH_KEY_PATH ? '-i ' + STAGING_SSH_KEY_PATH : ''} ${STAGING_SSH_USER}@${STAGING_SSH_HOST}`;
  const outTs = execSync(`${sshBase} "${tsCmd}"`).toString().trim();
  const dumpName = `projetogran_${outTs}.dump`;
  const remoteDumpPath = `${STAGING_BACKUP_DIR}/${dumpName}`;

  const remoteScript = [
    'set -e',
    'mkdir -p ' + STAGING_BACKUP_DIR,
    'echo "🔎 Validando container ' + PG_CONTAINER_NAME + '..."',
    "docker ps --format '{{.Names}}' | grep -q '^" + PG_CONTAINER_NAME + "$' || { echo '❌ Container " + PG_CONTAINER_NAME + " não está em execução'; exit 1; }",
    "DB_USER=$(docker exec " + PG_CONTAINER_NAME + " bash -lc 'echo -n \"${POSTGRES_USER:-postgres}\"')",
    "DB_PASS=$(docker exec " + PG_CONTAINER_NAME + " bash -lc 'echo -n \"${POSTGRES_PASSWORD:-}\"')",
    "[ -z \"$DB_PASS\" ] && DB_PASS=$(grep -E '^POSTGRES_PASSWORD=' /opt/projetogran/.env.staging 2>/dev/null | head -n1 | cut -d= -f2- | tr -d '\r' | sed -E 's/^\"(.*)\"$/\1/; s/^\047(.*)\047$/\1/; s/^[[:space:]]+|[[:space:]]+$//g')",
    "[ -z \"$DB_PASS\" ] && DB_PASS=$(grep -E '^POSTGRES_PASSWORD=' /opt/projetogran/.env.production 2>/dev/null | head -n1 | cut -d= -f2- | tr -d '\r' | sed -E 's/^\"(.*)\"$/\1/; s/^\047(.*)\047$/\1/; s/^[[:space:]]+|[[:space:]]+$//g')",
    "[ -z \"$DB_PASS\" ] && DB_PASS=postgres",
    "DB_NAME=$(docker exec " + PG_CONTAINER_NAME + " env PGPASSWORD=\"$DB_PASS\" psql -h localhost -U \"$DB_USER\" -d postgres -tAc \"SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN ('postgres') ORDER BY pg_database_size(datname) DESC LIMIT 1;\" | tr -d \"\r\n\")",
    "if [ -z \"$DB_NAME\" ]; then DB_NAME=$(docker exec " + PG_CONTAINER_NAME + " bash -lc 'echo -n \"${POSTGRES_DB:-projetogran}\"'); fi",
    'echo "🔎 DB_USER=$DB_USER DB_NAME=$DB_NAME"',
    'echo "🔎 Validando conexão..."',
    "docker exec " + PG_CONTAINER_NAME + " env PGPASSWORD=\"$DB_PASS\" psql -h localhost -U \"$DB_USER\" -d \"$DB_NAME\" -tAc \"SELECT current_database();\" | grep -q ^$DB_NAME$ || { echo \"❌ Conexão ao DB $DB_NAME falhou\"; exit 1; }",
    'echo "🔎 Realizando pg_dump (custom format)..."',
    "docker exec " + PG_CONTAINER_NAME + " env PGPASSWORD=\"$DB_PASS\" pg_dump -h localhost -U \"$DB_USER\" -d \"$DB_NAME\" -Fc > \"" + remoteDumpPath + "\"",
    'ls -lh "' + remoteDumpPath + '" || true',
    'if [ ! -s "' + remoteDumpPath + '" ]; then echo "❌ Backup vazio ou não encontrado: ' + remoteDumpPath + '"; exit 1; fi',
    'echo "✅ Backup criado: ' + remoteDumpPath + '"',
    'ls -1t ' + STAGING_BACKUP_DIR + '/projetogran_*.dump | tail -n +31 | xargs -r rm -f'
  ].join('\n');

  run(`${sshBase} << 'EOF'\n${remoteScript}\nEOF`);

  const localPath = path.join(LOCAL_BACKUP_DIR, dumpName);
  run(`scp -o StrictHostKeyChecking=no -P ${STAGING_SSH_PORT} ${STAGING_SSH_KEY_PATH ? '-i ' + STAGING_SSH_KEY_PATH : ''} ${STAGING_SSH_USER}@${STAGING_SSH_HOST}:\"${remoteDumpPath}\" \"${localPath}\"`);

  console.log('Backup copiado para:', localPath);
}

try { main(); } catch (e) { console.error('Falha no dump/cópia:', e?.message || e); process.exit(1); }