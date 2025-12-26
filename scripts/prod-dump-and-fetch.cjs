const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function getEnv(name, def = "") {
  return process.env[name] || def;
}
function run(cmd, opts = {}) {
  console.log("> " + cmd);
  execSync(cmd, { stdio: "inherit", ...opts });
}
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Faz dump do banco de PRODUÇÃO via SSH (docker exec no container postgres-prod),
 * copia o arquivo .dump para a máquina local em ./backups e informa o caminho.
 *
 * Variáveis esperadas (via ambiente):
 * - PROD_SSH_HOST (ou SERVER_HOST)
 * - PROD_SSH_USER (default: root)
 * - PROD_SSH_PORT (default: 22)
 * - PROD_SSH_KEY_PATH (opcional, caminho da chave privada)
 * - PROD_BACKUP_DIR (default: /var/backups/projetogran/production)
 * - PG_CONTAINER_NAME (default: postgres-prod)
 *
 * Observações:
 * - Não expõe segredos no repositório; usa envs no servidor remoto (/opt/projetogran/.env.production) e variáveis do container.
 * - Gera dump em formato custom (-Fc), ideal para restaurar com pg_restore.
 */
function main() {
  const PROD_SSH_HOST = getEnv("PROD_SSH_HOST") || getEnv("SERVER_HOST");
  const PROD_SSH_USER = getEnv("PROD_SSH_USER", "root");
  const PROD_SSH_PORT = getEnv("PROD_SSH_PORT", "22");
  const PROD_SSH_KEY_PATH = getEnv("PROD_SSH_KEY_PATH", "");
  const PROD_BACKUP_DIR = getEnv(
    "PROD_BACKUP_DIR",
    "/var/backups/projetogran/production"
  );
  const LOCAL_BACKUP_DIR = getEnv(
    "LOCAL_BACKUP_DIR",
    path.resolve(process.cwd(), "backups")
  );
  const PG_CONTAINER_NAME = getEnv("PG_CONTAINER_NAME", "postgres-prod");

  if (!PROD_SSH_HOST) {
    console.error(
      "PROD_SSH_HOST não definido. Configure PROD_SSH_* (ou SERVER_HOST) e tente novamente."
    );
    process.exit(1);
  }
  ensureDir(LOCAL_BACKUP_DIR);

  // Timestamp obtido do servidor (UTC) para padronizar nome do dump
  const tsCmd = "date -u +%Y%m%d_%H%M%S";
  const sshBase = `ssh -o StrictHostKeyChecking=no -p ${PROD_SSH_PORT} ${
    PROD_SSH_KEY_PATH ? "-i " + PROD_SSH_KEY_PATH : ""
  } ${PROD_SSH_USER}@${PROD_SSH_HOST}`;
  const outTs = execSync(`${sshBase} "${tsCmd}"`).toString().trim();
  const dumpName = `projetogran_${outTs}.dump`;
  const remoteDumpPath = `${PROD_BACKUP_DIR}/${dumpName}`;

  // Helpers para executar comandos simples via SSH, evitando here-doc no Windows
  function runSSH(cmd) {
    const escaped = cmd.replace(/"/g, '\\"');
    run(`${sshBase} "${escaped}"`);
  }
  function runSSHCapture(cmd) {
    const escaped = cmd.replace(/"/g, '\\"');
    return execSync(`${sshBase} "${escaped}"`).toString();
  }

  // Criar diretório remoto para os backups, se não existir
  runSSH(`mkdir -p "${PROD_BACKUP_DIR}"`);
  runSSH(`ls -ld "${PROD_BACKUP_DIR}" || true`);

  // 1) Validar container
  runSSH(`docker ps --format '{{.Names}}' | grep -q '^${PG_CONTAINER_NAME}$'`);

  // 2) Obter DB_USER e DB_PASS
  let DB_USER = runSSHCapture(
    `docker exec ${PG_CONTAINER_NAME} bash -lc 'echo -n \${POSTGRES_USER:-postgres}'`
  ).trim();
  let DB_PASS = runSSHCapture(
    `docker exec ${PG_CONTAINER_NAME} bash -lc 'echo -n \${POSTGRES_PASSWORD:-}'`
  ).trim();
  if (!DB_PASS) {
    DB_PASS = runSSHCapture(
      `bash -lc 'grep -E "^POSTGRES_PASSWORD=" /opt/projetogran/.env.production 2>/dev/null | head -n1 | cut -d= -f2- | tr -d "\\r" | sed -E "s/^\\\"(.*)\\\"$/\\1/; s/^\\047(.*)\\047$/\\1/; s/^[[:space:]]+|[[:space:]]+$//g"'`
    ).trim();
  }
  if (!DB_PASS) DB_PASS = "postgres";

  // 3) Identificar DB_NAME
  let DB_NAME = runSSHCapture(
    `docker exec ${PG_CONTAINER_NAME} bash -lc 'env PGPASSWORD="${DB_PASS}" psql -h localhost -U "${DB_USER}" -d postgres -tAc "SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN ('\\''postgres'\\'') ORDER BY pg_database_size(datname) DESC LIMIT 1;" | tr -d "\\r\\n"'`
  ).trim();
  if (!DB_NAME) {
    DB_NAME = runSSHCapture(
      `docker exec ${PG_CONTAINER_NAME} bash -lc 'echo -n \${POSTGRES_DB:-projetogran}'`
    ).trim();
  }

  // 4) Validar conexão
  runSSH(
    `docker exec ${PG_CONTAINER_NAME} bash -lc 'env PGPASSWORD="${DB_PASS}" psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -tAc "SELECT current_database();" | grep -q ^${DB_NAME}$'`
  );

  // 5) Gerar dump
  runSSH(
    `docker exec ${PG_CONTAINER_NAME} bash -lc 'env PGPASSWORD="${DB_PASS}" pg_dump -h localhost -U "${DB_USER}" -d "${DB_NAME}" -Fc' > "${remoteDumpPath}"`
  );
  runSSH(`ls -lh "${remoteDumpPath}" || true`);
  runSSH(
    `[ -s "${remoteDumpPath}" ] || { echo "❌ Backup vazio ou não encontrado: ${remoteDumpPath}"; exit 1; }`
  );
  runSSH(`echo "✅ Backup criado: ${remoteDumpPath}"`);
  runSSH(
    `ls -1t ${PROD_BACKUP_DIR}/projetogran_*.dump | tail -n +31 | xargs -r rm -f`
  );

  const localPath = path.join(LOCAL_BACKUP_DIR, dumpName);
  run(
    `scp -o StrictHostKeyChecking=no -P ${PROD_SSH_PORT} ${
      PROD_SSH_KEY_PATH ? "-i " + PROD_SSH_KEY_PATH : ""
    } ${PROD_SSH_USER}@${PROD_SSH_HOST}:\"${remoteDumpPath}\" \"${localPath}\"`
  );

  console.log("📦 Backup copiado para:", localPath);
  console.log("👉 Para restaurar em dev:");
  console.log(
    `   node scripts/dev-restore-from-dump.cjs --file="${localPath}"`
  );
}

try {
  main();
} catch (e) {
  console.error("Falha no dump/cópia (produção):", e?.message || e);
  process.exit(1);
}
