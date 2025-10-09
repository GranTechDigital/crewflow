# 🚀 Guia Completo: Deploy na Hostinger VPS com CyberPanel

## 📋 Pré-requisitos

- ✅ VPS Hostinger com CyberPanel instalado
- ✅ Acesso SSH ao servidor
- ✅ Docker instalado no CyberPanel
- ✅ Domínio configurado (opcional)

## 🔧 Passo 1: Preparar o Projeto

### 1.1 Arquivo já criado para upload
```bash
# O arquivo projetogran-deploy.tar.gz já foi criado e está pronto para upload
# Ele contém todo o projeto excluindo node_modules, .next, .git e uploads
```

### 1.2 Configurar variáveis de produção
Edite o arquivo `.env.production` com suas configurações:
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=file:./prisma/dev.db
NEXTAUTH_URL=https://seu-dominio.com
NEXTAUTH_SECRET=sua_chave_secreta_muito_segura_aqui
```

## 🌐 Passo 2: Upload para VPS

### Opção A: Via CyberPanel File Manager
1. Acesse CyberPanel → **File Manager**
2. Navegue para `/home/cyberpanel/`
3. Crie pasta `projetogran`
4. Upload do arquivo `projetogran-deploy.tar.gz`
5. Extrair: `tar -xzf projetogran-deploy.tar.gz`

### Opção B: Via SCP/SFTP
```bash
# Substitua SEU_IP pelo IP da sua VPS
scp projetogran-deploy.tar.gz root@SEU_IP:/home/cyberpanel/projetogran/
```

### Opção C: Via SSH direto
```bash
# Conectar via SSH
ssh root@SEU_IP

# Criar diretório
mkdir -p /home/cyberpanel/projetogran
cd /home/cyberpanel/projetogran

# Clonar repositório (se estiver no GitHub)
git clone https://github.com/seu-usuario/projetogran.git .
```

## 🐳 Passo 3: Configurar Docker no CyberPanel

### 3.1 Instalar Docker Manager (se não estiver instalado)
1. CyberPanel → **Addons**
2. Procurar por **Docker Manager**
3. Instalar e ativar

### 3.2 Acessar Docker Manager
1. CyberPanel → **Docker** → **Docker Manager**
2. Se não aparecer, reinicie o CyberPanel

## 🏗️ Passo 4: Build da Aplicação

### Opção A: Via Docker Manager (Interface)
1. **Docker Manager** → **Images** → **Create Image**
2. **Method**: Build from Dockerfile
3. **Build Context**: `/home/cyberpanel/projetogran`
4. **Image Name**: `projetogran-app`
5. **Tag**: `latest`
6. **Dockerfile Path**: `./Dockerfile`
7. Clique em **Build Image**

### Opção B: Via Terminal SSH
```bash
# Conectar via SSH
ssh root@SEU_IP

# Navegar para o projeto
cd /home/cyberpanel/projetogran

# Executar script de deploy
chmod +x deploy-cyberpanel.sh
./deploy-cyberpanel.sh
```

## 📦 Passo 5: Criar Container

### Via Docker Manager
1. **Docker Manager** → **Containers** → **Create Container**
2. Configurações:
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
   - **Restart Policy**: `unless-stopped`

3. Clique em **Create Container**

## 🌍 Passo 6: Configurar Website

### 6.1 Criar Website
1. **Websites** → **Create Website**
2. **Domain**: `seu-dominio.com`
3. **Email**: `seu-email@dominio.com`
4. **Package**: Selecione um pacote
5. Clique em **Create Website**

### 6.2 Configurar Proxy Reverso
1. **Websites** → **List Websites**
2. Clique em **Manage** no seu domínio
3. **Rewrite Rules**
4. Adicione a regra:

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
    client_max_body_size 50M;
}
```

## 🔒 Passo 7: Configurar SSL

1. **SSL** → **Issue SSL**
2. Selecione seu domínio
3. **SSL Provider**: Let's Encrypt
4. Clique em **Issue Now**
5. Aguarde a emissão (1-2 minutos)

## ✅ Passo 8: Verificar Deploy

### 8.1 Testar Aplicação
```bash
# Via SSH, testar se está respondendo
curl http://localhost:3000

# Testar via domínio
curl https://seu-dominio.com
```

### 8.2 Verificar Logs
```bash
# Logs do container
docker logs projetogran-container

# Status do container
docker ps
```

### 8.3 Verificar no CyberPanel
1. **Docker Manager** → **Containers**
2. Ver status do `projetogran-container`
3. **Websites** → **List Websites** → **Manage**
4. Verificar logs de acesso

## 🔧 Comandos Úteis

### Gerenciar Container
```bash
# Ver status
docker ps

# Ver logs
docker logs projetogran-container -f

# Reiniciar
docker restart projetogran-container

# Parar
docker stop projetogran-container

# Acessar container
docker exec -it projetogran-container sh
```

### Atualizar Aplicação
```bash
# Parar container
docker stop projetogran-container
docker rm projetogran-container

# Atualizar código (se usando git)
git pull origin main

# Rebuild e restart
./deploy-cyberpanel.sh
```

## 🚨 Troubleshooting

### Container não inicia
```bash
# Ver logs detalhados
docker logs projetogran-container

# Verificar imagem
docker images | grep projetogran

# Verificar porta
netstat -tulpn | grep 3000
```

### Site não carrega
1. Verificar se container está rodando: `docker ps`
2. Testar diretamente: `curl http://localhost:3000`
3. Verificar configuração do proxy no CyberPanel
4. Verificar logs do Nginx no CyberPanel

### Problemas de SSL
1. Verificar se domínio aponta para o IP correto
2. Reemitir certificado SSL no CyberPanel
3. Verificar se porta 443 está aberta

### Banco de dados
```bash
# Acessar container e verificar banco
docker exec -it projetogran-container sh
ls -la /app/prisma/
npx prisma migrate status
```

## 📊 Monitoramento

### Via CyberPanel
- **Docker Manager**: Status dos containers
- **Websites**: Logs de acesso e erro
- **System**: Uso de recursos

### Via Comandos
```bash
# Uso de recursos
docker stats projetogran-container

# Logs em tempo real
docker logs projetogran-container -f

# Status do sistema
htop
df -h
```

## 🎉 Finalização

Após seguir todos os passos:

1. ✅ Aplicação rodando em container Docker
2. ✅ Proxy reverso configurado
3. ✅ SSL/HTTPS ativo
4. ✅ Domínio funcionando
5. ✅ Monitoramento ativo

**URL Final**: `https://seu-dominio.com`

## 📞 Suporte

Se encontrar problemas:
1. Verificar logs do container
2. Verificar configurações do CyberPanel
3. Testar conectividade de rede
4. Verificar recursos do servidor (CPU/RAM/Disk)

**Sucesso! 🚀 Sua aplicação está rodando na Hostinger com CyberPanel!**