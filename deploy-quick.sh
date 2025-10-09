#!/bin/bash
echo "🚀 Iniciando deploy rápido do CrewFlow..."

# 1. Build da imagem
echo "🔧 Fazendo build da imagem..."
docker build -t crewflow-app:latest .

if [ $? -ne 0 ]; then
    echo "❌ Erro no build da imagem!"
    exit 1
fi

# 2. Enviar para servidor
echo "📤 Enviando para servidor..."
docker save crewflow-app:latest | ssh root@46.202.146.234 "docker load"

if [ $? -ne 0 ]; then
    echo "❌ Erro ao enviar imagem para servidor!"
    exit 1
fi

# 3. Atualizar container
echo "🔄 Atualizando container..."
ssh root@46.202.146.234 "
  docker stop crewflow-app-production 2>/dev/null || true &&
  docker rm crewflow-app-production 2>/dev/null || true &&
  docker run -d --name crewflow-app-production -p 3001:3000 \
    -e DATABASE_URL='file:./dev.db' \
    -e JWT_SECRET='crewflow-jwt-secret-key-2024' \
    -e NEXTAUTH_URL='http://localhost:3000' \
    -e NODE_ENV='development' \
    crewflow-app:latest
"

if [ $? -ne 0 ]; then
    echo "❌ Erro ao atualizar container!"
    exit 1
fi

echo ""
echo "✅ Deploy do CrewFlow concluído com sucesso!"
echo "🌐 Aplicação disponível em: http://46.202.146.234:3001"
echo "🔐 Login: ADMIN001 / admin123"
echo ""
echo "🔍 Para verificar status:"
echo "   ssh root@46.202.146.234 'docker ps | grep crewflow'"
echo ""
echo "📋 Para ver logs:"
echo "   ssh root@46.202.146.234 'docker logs crewflow-app-production'"