const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { file: '', batch: 1000 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--file=')) args.file = a.split('=')[1];
    else if (a.startsWith('--batch=')) args.batch = parseInt(a.split('=')[1] || '1000', 10) || 1000;
  }
  return args;
}

function run(cmd) {
  console.log('> ' + cmd);
  execSync(cmd, { stdio: 'inherit' });
}

function loadEnvDev() {
  const dotenvPath = path.resolve(process.cwd(), '.env.dev');
  const env = fs.readFileSync(dotenvPath, 'utf-8');
  const map = {};
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) map[m[1]] = m[2];
  }
  return map;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.file) {
    console.error('Uso: node scripts/dev-restore-from-dump.cjs --file=PATH_TO_DUMP [--batch=1000]');
    process.exit(1);
  }
  const dumpPath = path.resolve(args.file);
  if (!fs.existsSync(dumpPath)) {
    console.error('Arquivo não encontrado:', dumpPath);
    process.exit(1);
  }
  const env = loadEnvDev();
  const POSTGRES_DB = env.POSTGRES_DB || 'projetogran';
  const POSTGRES_USER = env.POSTGRES_USER || 'postgres';

  // Copiar dump para dentro do container postgres-dev
  run(`docker cp "${dumpPath}" postgres-dev:/tmp/restore.dump`);

  // Restaurar no postgres-dev
  // Resetar schema public por completo para evitar duplicatas em COPY/constraints
  run(`docker exec postgres-dev sh -lc "psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c 'DROP SCHEMA IF EXISTS public CASCADE;' -c 'CREATE SCHEMA public;' -c 'GRANT ALL ON SCHEMA public TO ${POSTGRES_USER};' -c 'GRANT ALL ON SCHEMA public TO public;'"`);
  run(`docker exec postgres-dev sh -lc "pg_restore -U ${POSTGRES_USER} -d ${POSTGRES_DB} -Fc --no-owner --no-acl --role=${POSTGRES_USER} /tmp/restore.dump"`);

  // Ajustes de dados pré-push (ex.: slug de função requerido e duplicatas) diretamente via SQL
  run(`docker exec postgres-dev sh -lc "psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} <<'SQL'\n-- Preencher funcao_slug para nulos/vazios; quando funcao for nula/vazia, use fallback baseado no id\nUPDATE \\\"Funcao\\\" f\nSET funcao_slug = CASE \n  WHEN f.funcao IS NULL OR btrim(f.funcao) = '' THEN CONCAT('funcao-', f.id)\n  ELSE lower(regexp_replace(f.funcao, '[^a-z0-9]+', '-', 'g'))\nEND\nWHERE f.funcao_slug IS NULL OR f.funcao_slug = '';\n\n-- Resolver duplicatas por (funcao_slug, regime) adicionando sufixos incrementais\nWITH cte AS (\n  SELECT id, funcao_slug, regime,\n         ROW_NUMBER() OVER (PARTITION BY funcao_slug, regime ORDER BY id) AS rn\n  FROM \\\"Funcao\\\"\n)\nUPDATE \\\"Funcao\\\" f\nSET funcao_slug = f.funcao_slug || '-' || cte.rn\nFROM cte\nWHERE f.id = cte.id AND cte.rn > 1;\nSQL"`);

  // Sincronizar schema e gerar client
  run(`docker exec crewflow-app-dev sh -lc "npx prisma db push --accept-data-loss && npx prisma generate"`);

  // Backfill unificado para adaptar dados
  run(`docker exec crewflow-app-dev node scripts/backfill-unificado.cjs --apply --batch=${args.batch}`);

  console.log('Restauração e backfill concluídos com sucesso.');
}

main().catch((e) => { console.error(e); process.exit(1); });
