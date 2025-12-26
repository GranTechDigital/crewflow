const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd) { console.log('> ' + cmd); execSync(cmd, { stdio: 'inherit' }); }
function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function latestDump(backupsDir) {
  const files = fs.readdirSync(backupsDir)
    .filter(f => /^projetogran_\d{8}_\d{6}\.dump$/.test(f))
    .sort((a, b) => b.localeCompare(a)); // nome contém timestamp; ordena desc
  return files[0] ? path.join(backupsDir, files[0]) : null;
}

/**
 * Pipeline: gerar dump na produção, copiar para local e restaurar no postgres-dev.
 * Requer SSH configurado (PROD_SSH_*), docker-compose dev up e containers acessíveis.
 */
function main() {
  const backupsDir = path.resolve(process.cwd(), 'backups');
  ensureDir(backupsDir);

  // 1) Dump + fetch de produção
  run('node scripts/prod-dump-and-fetch.cjs');

  // 2) Encontrar o dump mais recente
  const dumpPath = latestDump(backupsDir);
  if (!dumpPath) {
    console.error('Nenhum dump encontrado em ./backups após o fetch.');
    process.exit(1);
  }
  console.log('🗂️ Dump encontrado:', dumpPath);

  // 3) Restaurar no postgres-dev e aplicar backfills/ajustes
  run(`node scripts/dev-restore-from-dump.cjs --file="${dumpPath}" --batch=1000`);

  console.log('✅ Sincronização Produção → Dev concluída com sucesso.');
}

try { main(); } catch (e) { console.error('Falha na sincronização completa:', e?.message || e); process.exit(1); }

