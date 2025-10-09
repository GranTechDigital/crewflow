# Deploy Manual no CyberPanel

Como o Docker Manager pode ter limitações, aqui está o processo manual completo:

## 🚀 Método 1: Deploy via SSH (Recomendado)

### 1. Conectar ao Servidor
```bash
ssh root@seu-servidor-hostinger.com
```

### 2. Instalar Docker (se não estiver instalado)
```bash
# Atualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Iniciar Docker
systemctl start docker
systemctl enable docker

# Verificar instalação
docker --version
```

### 3. Preparar Projeto
```bash
# Criar diretório
mkdir -p /home/cyberpanel/projetogran
cd /home/cyberpanel/projetogran

# Clonar repositório (se usar Git)
git clone https://github.com/seu-usuario/projetogran.git .

# OU fazer upload manual dos arquivos via SFTP/SCP
```

### 4. Configurar Ambiente
```bash
# Criar arquivo .env.production
cat > .env.production << EOF
NODE_ENV=production
DATABASE_URL=file:./prisma/dev.db
PORT=3000
NEXTAUTH_URL=https://seu-dominio.com
NEXTAUTH_SECRET=$(openssl rand -base64 32)
EOF

# Criar diretórios necessários
mkdir -p prisma uploads logs
```

### 5. Construir e Executar
```bash
# Construir imagem
docker build -t projetogran-app:latest .

# Executar container
docker run -d \
  --name projetogran-container \
  -p 3000:3000 \
  --env-file .env.production \
  -v $(pwd)/prisma:/app/prisma \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/logs:/app/logs \
  --restart unless-stopped \
  projetogran-app:latest

# Verificar se está rodando
docker ps
```

## 🌐 Método 2: Configurar no CyberPanel

### 1. Criar Website
1. **Websites** → **Create Website**
2. **Domain**: seu-dominio.com
3. **Email**: seu-email@dominio.com
4. **Create Website**

### 2. Configurar Proxy Reverso
1. **Websites** → **List Websites** → **Manage** (seu domínio)
2. **Rewrite Rules** → **Create Rewrite Rule**
3. Adicionar regra:

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
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
```

### 3. Configurar SSL
1. **SSL** → **Issue SSL**
2. Selecionar domínio
3. **Let's Encrypt**
4. **Issue Now**

## 📋 Método 3: Upload Manual de Arquivos

### 1. Preparar Arquivos Localmente
```bash
# No seu computador local
# Criar arquivo compactado
tar -czf projetogran.tar.gz .
```

### 2. Upload via SFTP/SCP
```bash
# Upload do arquivo
scp projetogran.tar.gz root@seu-servidor:/home/cyberpanel/

# No servidor, extrair
ssh root@seu-servidor
cd /home/cyberpanel
tar -xzf projetogran.tar.gz
mv projetogran-* projetogran  # se necessário
cd projetogran
```

### 3. Executar Deploy
```bash
# Tornar script executável
chmod +x deploy-cyberpanel.sh

# Executar deploy
./deploy-cyberpanel.sh
```

## 🔧 Comandos Úteis

### Gerenciar Container
```bash
# Ver containers rodando
docker ps

# Ver logs
docker logs projetogran-container

# Parar container
docker stop projetogran-container

# Reiniciar container
docker restart projetogran-container

# Remover container
docker rm projetogran-container

# Acessar container
docker exec -it projetogran-container sh
```

### Atualizar Aplicação
```bash
# Parar container atual
docker stop projetogran-container
docker rm projetogran-container

# Atualizar código (se usando Git)
git pull origin main

# Reconstruir imagem
docker build -t projetogran-app:latest .

# Executar novo container
docker run -d \
  --name projetogran-container \
  -p 3000:3000 \
  --env-file .env.production \
  -v $(pwd)/prisma:/app/prisma \
  -v $(pwd)/uploads:/app/uploads \
  --restart unless-stopped \
  projetogran-app:latest
```

### Backup do Banco
```bash
# Backup
docker exec projetogran-container cp /app/prisma/dev.db /app/prisma/backup-$(date +%Y%m%d).db

# Copiar backup para host
docker cp projetogran-container:/app/prisma/backup-$(date +%Y%m%d).db ./
```

## 🚨 Troubleshooting

### Container não inicia
```bash
# Ver logs detalhados
docker logs projetogran-container

# Verificar imagem
docker images

# Testar build
docker build -t test-app .
```

### Aplicação não responde
```bash
# Testar porta
curl http://localhost:3000

# Verificar se porta está ocupada
netstat -tulpn | grep 3000

# Verificar proxy no CyberPanel
tail -f /usr/local/lsws/logs/access.log
```

### Problemas de SSL
```bash
# Verificar certificado
openssl s_client -connect seu-dominio.com:443

# Renovar SSL no CyberPanel
# SSL → Manage SSL → Force Renew
```

## ✅ Checklist Final

- [ ] Docker instalado e funcionando
- [ ] Projeto enviado para servidor
- [ ] Arquivo .env.production configurado
- [ ] Imagem Docker construída
- [ ] Container rodando na porta 3000
- [ ] Website criado no CyberPanel
- [ ] Proxy reverso configurado
- [ ] SSL ativado
- [ ] Domínio apontando para servidor
- [ ] Aplicação acessível via HTTPS

Pronto! Sua aplicação estará rodando no CyberPanel.