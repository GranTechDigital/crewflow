const { execSync } = require("child_process");

function getEnv(name, def = "") {
  return process.env[name] || def;
}
function run(cmd, opts = {}) {
  console.log("> " + cmd);
  execSync(cmd, { stdio: "inherit", ...opts });
}
function runCapture(cmd, opts = {}) {
  return execSync(cmd, { stdio: "pipe", ...opts }).toString();
}

/**
 * Adiciona (se não existir) a equipe "Liderança (Visualizador)" em PRODUÇÃO via SSH,
 * executando psql dentro do container postgres-prod.
 *
 * Variáveis esperadas (via ambiente):
 * - PROD_SSH_HOST (ou SERVER_HOST)
 * - PROD_SSH_USER (default: root)
 * - PROD_SSH_PORT (default: 22)
 * - PROD_SSH_KEY_PATH (opcional, caminho da chave privada)
 * - PG_CONTAINER_NAME (default: postgres-prod)
 */
function main() {
  const PROD_SSH_HOST = getEnv("PROD_SSH_HOST") || getEnv("SERVER_HOST");
  const PROD_SSH_USER = getEnv("PROD_SSH_USER", "root");
  const PROD_SSH_PORT = getEnv("PROD_SSH_PORT", "22");
  const PROD_SSH_KEY_PATH = getEnv("PROD_SSH_KEY_PATH", "");
  const PG_CONTAINER_NAME = getEnv("PG_CONTAINER_NAME", "postgres-prod");

  if (!PROD_SSH_HOST) {
    console.error(
      "PROD_SSH_HOST não definido. Configure PROD_SSH_* (ou SERVER_HOST) e tente novamente."
    );
    process.exit(1);
  }

  const sshBase = `ssh -o StrictHostKeyChecking=no -p ${PROD_SSH_PORT} ${
    PROD_SSH_KEY_PATH ? "-i " + PROD_SSH_KEY_PATH : ""
  } ${PROD_SSH_USER}@${PROD_SSH_HOST}`;

  function runSSH(cmd) {
    const escaped = cmd.replace(/"/g, '\\"');
    run(`${sshBase} "${escaped}"`);
  }
  function runSSHCapture(cmd) {
    const escaped = cmd.replace(/"/g, '\\"');
    return runCapture(`${sshBase} "${escaped}"`).trim();
  }

  // Validar container
  runSSH(`docker ps --format '{{.Names}}' | grep -q '^${PG_CONTAINER_NAME}$'`);

  // Obter DB_USER e DB_PASS
  let DB_USER = runSSHCapture(
    `docker exec ${PG_CONTAINER_NAME} bash -lc 'echo -n \${POSTGRES_USER:-postgres}'`
  );
  let DB_PASS = runSSHCapture(
    `docker exec ${PG_CONTAINER_NAME} bash -lc 'echo -n \${POSTGRES_PASSWORD:-}'`
  );
  if (!DB_PASS) {
    DB_PASS = runSSHCapture(
      `bash -lc 'grep -E "^POSTGRES_PASSWORD=" /opt/projetogran/.env.production 2>/dev/null | head -n1 | cut -d= -f2- | tr -d "\\r" | sed -E "s/^\\\"(.*)\\\"$/\\1/; s/^\\047(.*)\\047$/\\1/; s/^[[:space:]]+|[[:space:]]+$//g"'`
    );
  }
  if (!DB_PASS) DB_PASS = "postgres";

  // Identificar DB_NAME
  let DB_NAME = runSSHCapture(
    `docker exec ${PG_CONTAINER_NAME} bash -lc 'env PGPASSWORD="${DB_PASS}" psql -h localhost -U "${DB_USER}" -d postgres -tAc "SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN ('\\''postgres'\\'') ORDER BY pg_database_size(datname) DESC LIMIT 1;" | tr -d "\\r\\n"'`
  );
  if (!DB_NAME) {
    DB_NAME = runSSHCapture(
      `docker exec ${PG_CONTAINER_NAME} bash -lc 'echo -n \${POSTGRES_DB:-projetogran}'`
    );
  }

  // Inserir Liderança (Visualizador) se não existir
  const sql =
    `INSERT INTO "Equipe" (nome, descricao, ativo) ` +
    `VALUES ('Liderança (Visualizador)', 'Equipe Liderança (Visualizador)', true) ` +
    `ON CONFLICT (nome) DO NOTHING; ` +
    `SELECT id, nome, ativo FROM "Equipe" WHERE nome LIKE 'Liderança%';`;

  runSSH(
    `docker exec ${PG_CONTAINER_NAME} bash -lc 'env PGPASSWORD="${DB_PASS}" psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -tAc "${sql}"'`
  );

  console.log("✅ Liderança (Visualizador) verificada/inserida em produção.");
}

try {
  main();
} catch (e) {
  console.error("Falha ao inserir Liderança (Visualizador):", e?.message || e);
  process.exit(1);
}
