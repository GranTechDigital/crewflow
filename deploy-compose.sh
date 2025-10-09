#!/bin/bash
echo "🚀 Iniciando deploy com Docker Compose..."

# 1. Enviar arquivos para servidor
echo "📤 Enviando arquivos para servidor..."
scp docker-compose.yml Dockerfile .dockerignore root@46.202.146.234:/root/projetogran/
scp -r . root@46.202.146.234:/root/projetogran/ --exclude=node_modules --exclude=.next --exclude=.git

if [ $? -ne 0 ]; then
    echo "❌ Erro ao enviar arquivos!"
    exit 1
fi

# 2. Deploy no servidor
echo "🔄 Fazendo deploy no servidor..."
ssh root@46.202.146.234 "
  cd /root/projetogran &&
  docker-compose down &&
  docker-compose up -d --build
"

if [ $? -ne 0 ]; then
    echo "❌ Erro no deploy!"
    exit 1
fi

# 3. Executar seed
echo "🌱 Executando seed..."
ssh root@46.202.146.234 "
  cd /root/projetogran &&
  docker-compose exec app npm run seed
"

echo ""
echo "✅ Deploy concluído com sucesso!"
echo "🌐 Aplicação disponível em: http://46.202.146.234:3001"
echo "🔐 Login: ADMIN001 / admin123"
echo ""
echo "🔍 Para verificar status:"
echo "   ssh root@46.202.146.234 'cd /root/projetogran && docker-compose ps'"
echo ""
echo "📋 Para ver logs:"
echo "   ssh root@46.202.146.234 'cd /root/projetogran && docker-compose logs app'"