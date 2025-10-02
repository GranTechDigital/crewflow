const fs = require('fs');
const path = require('path');

console.log('🔍 Validando estrutura de seeds organizada...\n');

const seedsDir = path.join(__dirname, 'seeds');
const requiredStructure = {
  'data/status.json': 'array',
  'data/status-mapping.json': 'array',
  'data/projetos.json': 'array',
  'data/centros-custo-projeto.json': 'array',
  'config/seed-config.json': 'object'
};

let allValid = true;
let totalRecords = 0;

Object.entries(requiredStructure).forEach(([filePath, expectedType]) => {
  const fullPath = path.join(seedsDir, filePath);
  
  if (fs.existsSync(fullPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      const isCorrectType = expectedType === 'array' ? Array.isArray(data) : typeof data === 'object';
      
      if (isCorrectType) {
        const count = Array.isArray(data) ? data.length : Object.keys(data).length;
        console.log(`✅ ${filePath}: ${count} registros`);
        if (Array.isArray(data)) totalRecords += count;
      } else {
        console.log(`❌ ${filePath}: Tipo incorreto (esperado: ${expectedType})`);
        allValid = false;
      }
    } catch (error) {
      console.log(`❌ ${filePath}: Erro ao ler JSON - ${error.message}`);
      allValid = false;
    }
  } else {
    console.log(`❌ ${filePath}: Arquivo não encontrado`);
    allValid = false;
  }
});

console.log(`\n📊 Total de registros de dados: ${totalRecords}`);

if (allValid) {
  console.log('\n🎉 Estrutura de seeds válida e organizada!');
} else {
  console.log('\n⚠️  Problemas encontrados na estrutura de seeds.');
  process.exit(1);
}