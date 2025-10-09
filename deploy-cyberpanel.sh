#!/bin/bash

# Script de Deploy para CyberPanel
# Uso: ./deploy-cyberpanel.sh

set -e

echo "🚀 Iniciando deploy no CyberPanel..."

# Configurações
CONTAINER_NAME="projetogran-container"
IMAGE_NAME="projetogran-app"
IMAGE_TAG="latest"
PORT="3000"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log colorido
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    error "Docker não está instalado!"
    exit 1
fi

log "Docker encontrado: $(docker --version)"

# Parar e remover container existente
if docker ps -a --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    warn "Parando container existente..."
    docker stop ${CONTAINER_NAME} || true
    docker rm ${CONTAINER_NAME} || true
fi

# Remover imagem antiga se existir
if docker images --format 'table {{.Repository}}:{{.Tag}}' | grep -q "^${IMAGE_NAME}:${IMAGE_TAG}$"; then
    warn "Removendo imagem antiga..."
    docker rmi ${IMAGE_NAME}:${IMAGE_TAG} || true
fi

# Verificar se arquivo .env.production existe
if [ ! -f ".env.production" ]; then
    warn "Arquivo .env.production não encontrado. Criando exemplo..."
    cat > .env.production << EOF
NODE_ENV=production
DATABASE_URL=file:./prisma/dev.db
PORT=3000
NEXTAUTH_URL=https://seu-dominio.com
NEXTAUTH_SECRET=seu-secret-aqui
EOF
    warn "Configure o arquivo .env.production antes de continuar!"
fi

# Construir nova imagem
log "Construindo imagem Docker..."
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .

# Verificar se a imagem foi criada
if ! docker images --format 'table {{.Repository}}:{{.Tag}}' | grep -q "^${IMAGE_NAME}:${IMAGE_TAG}$"; then
    error "Falha ao criar imagem Docker!"
    exit 1
fi

log "Imagem criada com sucesso!"

# Criar diretórios necessários
mkdir -p ./prisma
mkdir -p ./uploads
mkdir -p ./logs

# Executar container
log "Iniciando container..."
docker run -d \
  --name ${CONTAINER_NAME} \
  -p ${PORT}:${PORT} \
  --env-file .env.production \
  -v $(pwd)/prisma:/app/prisma \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/logs:/app/logs \
  --restart unless-stopped \
  ${IMAGE_NAME}:${IMAGE_TAG}

# Aguardar container iniciar
log "Aguardando container inicializar..."
sleep 10

# Verificar se container está rodando
if docker ps --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log "Container iniciado com sucesso!"
else
    error "Falha ao iniciar container!"
    echo "Logs do container:"
    docker logs ${CONTAINER_NAME}
    exit 1
fi

# Executar migrações do banco
log "Executando migrações do banco de dados..."
docker exec ${CONTAINER_NAME} npx prisma migrate deploy || warn "Migrações falharam ou não necessárias"

# Testar aplicação
log "Testando aplicação..."
sleep 5
if curl -f http://localhost:${PORT} > /dev/null 2>&1; then
    log "✅ Aplicação respondendo corretamente!"
else
    warn "⚠️  Aplicação pode não estar respondendo ainda. Verifique os logs."
fi

# Mostrar informações do deploy
echo ""
echo -e "${BLUE}===========================================${NC}"
echo -e "${GREEN}🎉 Deploy concluído com sucesso!${NC}"
echo -e "${BLUE}===========================================${NC}"
echo -e "📦 Container: ${CONTAINER_NAME}"
echo -e "🖼️  Imagem: ${IMAGE_NAME}:${IMAGE_TAG}"
echo -e "🌐 URL Local: http://localhost:${PORT}"
echo -e "📊 Status: $(docker ps --format 'table {{.Status}}' --filter name=${CONTAINER_NAME})"
echo ""
echo -e "${YELLOW}Comandos úteis:${NC}"
echo -e "  Ver logs:     docker logs ${CONTAINER_NAME}"
echo -e "  Parar:        docker stop ${CONTAINER_NAME}"
echo -e "  Reiniciar:    docker restart ${CONTAINER_NAME}"
echo -e "  Acessar:      docker exec -it ${CONTAINER_NAME} sh"
echo ""
echo -e "${BLUE}Próximos passos no CyberPanel:${NC}"
echo -e "1. Configure o proxy reverso para a porta ${PORT}"
echo -e "2. Configure SSL/HTTPS"
echo -e "3. Configure domínio personalizado"
echo ""

log "Deploy finalizado!"