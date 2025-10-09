# Deploy no CyberPanel usando Docker Manager

O CyberPanel tem funcionalidades nativas para gerenciar containers Docker. Aqui está como usar:

## 🐳 Usando o Docker Manager do CyberPanel

### 1. Acessar Docker Manager
1. Faça login no CyberPanel
2. Vá em **Docker** > **Docker Manager**
3. Se não aparecer, instale via **Addons** > **Docker Manager**

### 2. Criar Imagem Docker

#### Opção A: Build from Repository (Recomendado)
1. No Docker Manager, clique em **Create Image**
2. **Method**: Build from Git Repository
3. **Repository URL**: `https://github.com/seu-usuario/projetogran.git`
4. **Image Name**: `projetogran-app`
5. **Tag**: `latest`
6. **Dockerfile Path**: `./Dockerfile`
7. Clique em **Create Image**

#### Opção B: Via Terminal SSH
Se não houver opção de repositório, use o terminal:
```bash
# Conectar via SSH ao servidor
ssh root@seu-servidor.com

# Navegar para diretório do projeto
cd /home/cyberpanel/projetogran

# Construir imagem manualmente
docker build -t projetogran-app:latest .
```

### 3. Criar Container

1. Após a imagem ser criada, vá em **Containers**
2. Clique em **Create Container**
3. Configure:
   - **Container Name**: `projetogran-container`
   - **Image**: `projetogran-app:latest`
   - **Port Mapping**: `3000:3000`
   - **Environment Variables**:
     ```
     NODE_ENV=production
     DATABASE_URL=file:./prisma/dev.db
     PORT=3000
     ```
   - **Volume Mounts**:
     ```
     /home/cyberpanel/projetogran/prisma:/app/prisma
     /home/cyberpanel/projetogran/uploads:/app/uploads
     ```

### 4. Configurar Website no CyberPanel

1. **Websites** > **Create Website**
2. **Domain**: seu-dominio.com
3. **Email**: seu-email@dominio.com
4. Clique em **Create Website**

### 5. Configurar Proxy Reverso

1. Vá em **Websites** > **List Websites**
2. Clique em **Manage** no seu domínio
3. **Rewrite Rules** > **Add Rule**
4. Adicione:
```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

### 6. Configurar SSL

1. **SSL** > **Issue SSL**
2. Selecione seu domínio
3. Escolha **Let's Encrypt**
4. Clique em **Issue Now**

## 📋 Configuração Simplificada

### Arquivo docker-compose.yml para CyberPanel
```yaml
version: '3.8'

services:
  app:
    image: projetogran-app:latest
    container_name: projetogran-container
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:./prisma/dev.db
      - PORT=3000
    volumes:
      - ./prisma:/app/prisma
      - ./uploads:/app/uploads
    restart: unless-stopped
```

## 🔄 Processo de Deploy Automático

### Script para CyberPanel (deploy-cyberpanel.sh)
```bash
#!/bin/bash

echo "🚀 Deploy no CyberPanel..."

# Parar container existente
docker stop projetogran-container 2>/dev/null || true
docker rm projetogran-container 2>/dev/null || true

# Remover imagem antiga
docker rmi projetogran-app:latest 2>/dev/null || true

# Construir nova imagem
docker build -t projetogran-app:latest .

# Executar container
docker run -d \
  --name projetogran-container \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="file:./prisma/dev.db" \
  -e PORT=3000 \
  -v $(pwd)/prisma:/app/prisma \
  -v $(pwd)/uploads:/app/uploads \
  --restart unless-stopped \
  projetogran-app:latest

echo "✅ Deploy concluído!"
echo "🌐 Aplicação rodando em: http://localhost:3000"
```

## 🛠️ Comandos Úteis via CyberPanel Terminal

### Verificar containers
```bash
docker ps
```

### Ver logs do container
```bash
docker logs projetogran-container
```

### Acessar container
```bash
docker exec -it projetogran-container sh
```

### Atualizar aplicação
```bash
# Parar container
docker stop projetogran-container

# Atualizar código
git pull origin main

# Rebuild imagem
docker build -t projetogran-app:latest .

# Reiniciar container
docker start projetogran-container
```

## 📊 Monitoramento no CyberPanel

1. **Docker Manager** > **Containers**
   - Ver status dos containers
   - Logs em tempo real
   - Estatísticas de uso

2. **Websites** > **List Websites** > **Manage**
   - Logs do Nginx
   - Estatísticas de acesso
   - Monitoramento SSL

## 🔧 Troubleshooting

### Container não inicia
1. Verifique logs: `docker logs projetogran-container`
2. Verifique porta: `netstat -tulpn | grep 3000`
3. Verifique imagem: `docker images`

### Aplicação não carrega
1. Teste diretamente: `curl http://localhost:3000`
2. Verifique proxy reverso no CyberPanel
3. Verifique SSL se usando HTTPS

### Banco de dados
1. Verifique volume mount: `docker exec -it projetogran-container ls -la /app/prisma`
2. Execute migrações: `docker exec -it projetogran-container npx prisma migrate deploy`

## 🚀 Deploy Rápido

1. **Upload do projeto** para `/home/cyberpanel/projetogran/`
2. **Criar imagem** via Docker Manager
3. **Criar container** com port 3000
4. **Configurar proxy** no website
5. **Ativar SSL**

Pronto! Sua aplicação estará rodando com todas as funcionalidades do CyberPanel.