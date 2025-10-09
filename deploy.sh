#!/bin/bash

# Script de deploy para VPS com CyberPanel

echo "🚀 Iniciando deploy da aplicação..."

# Parar containers existentes
echo "⏹️ Parando containers existentes..."
docker-compose down

# Fazer backup do banco de dados (se existir)
if [ -f "./prisma/dev.db" ]; then
    echo "💾 Fazendo backup do banco de dados..."
    cp ./prisma/dev.db ./prisma/dev.db.backup.$(date +%Y%m%d_%H%M%S)
fi

# Atualizar código do repositório
echo "📥 Atualizando código..."
git pull origin main

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

# Executar migrações do Prisma
echo "🗄️ Executando migrações do banco..."
npx prisma migrate deploy
npx prisma generate

# Build da aplicação
echo "🔨 Fazendo build da aplicação..."
npm run build

# Iniciar containers
echo "🐳 Iniciando containers Docker..."
docker-compose up -d --build

# Verificar status
echo "✅ Verificando status dos containers..."
docker-compose ps

echo "🎉 Deploy concluído!"
echo "📱 Aplicação disponível em: http://localhost:3000"
echo "🗄️ Banco de dados disponível em: localhost:5432"