import fs from 'fs';

console.log('🔧 Aplicando correção do cookie...');

const routePath = '.next/server/app/api/auth/login/route.js';

try {
    // Lê o arquivo
    let content = fs.readFileSync(routePath, 'utf8');
    
    console.log('📄 Arquivo lido com sucesso');
    
    // Substitui a configuração do secure (código minificado)
    const originalContent = content;
    
    // Procura por secure:!0 (que é secure: true minificado)
    content = content.replace(/secure:!0/g, 'secure:!1');
    
    if (content !== originalContent) {
        // Escreve o arquivo modificado
        fs.writeFileSync(routePath, content);
        console.log('✅ Cookie fix aplicado com sucesso!');
        console.log('🔒 secure:!0 → secure:!1 (true → false)');
    } else {
        console.log('⚠️ Nenhuma alteração necessária - padrão não encontrado');
        console.log('🔍 Procurando por outros padrões...');
        
        // Tenta outros padrões possíveis
        if (content.includes('secure:true')) {
            content = content.replace(/secure:true/g, 'secure:false');
            fs.writeFileSync(routePath, content);
            console.log('✅ Padrão alternativo corrigido: secure:true → secure:false');
        } else if (content.includes('secure: true')) {
            content = content.replace(/secure: true/g, 'secure: false');
            fs.writeFileSync(routePath, content);
            console.log('✅ Padrão alternativo corrigido: secure: true → secure: false');
        } else {
            console.log('❌ Nenhum padrão de secure encontrado');
        }
    }
    
} catch (error) {
    console.error('❌ Erro ao aplicar correção:', error.message);
    process.exit(1);
}