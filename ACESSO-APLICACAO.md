
# 🚀 Acesso e Deploy da Aplicação

## ✅ Status Atual

**🌐 Aplicação Online:** http://46.202.146.234:3001  
**🔐 Login:** ADMIN001 / admin123  
**📊 Status:** ✅ Funcionando perfeitamente  
**🍪 Cookie:** ✅ Corrigido (secure: false)

---

## 🎯 **DEPLOY AUTOMÁTICO COM GITHUB ACTIONS** ⭐

### 🚀 **Opção Recomendada: GitHub Actions**

**Vantagens:**
- ✅ **Deploy automático** no `git push`
- ✅ **Zero configuração** após setup inicial
- ✅ **Histórico completo** de deploys
- ✅ **Notificações** automáticas
- ✅ **Rollback fácil** para versões anteriores
- ✅ **Gratuito** (2000 min/mês)

### 📋 **Setup Rápido (5 minutos):**

1. **Configure Secrets no GitHub:**
   - `SSH_PRIVATE_KEY` → Sua chave SSH privada
   - `SERVER_HOST` → `46.202.146.234`

2. **Faça push:**
   ```bash
   git add .
   git commit -m "Deploy automático"
   git push origin main
   ```

3. **Pronto!** Deploy acontece automaticamente 🎉

**📖 Guia completo:** <mcfile name="GITHUB-ACTIONS-SETUP.md" path="c:\Users\luanx\projetogran\GITHUB-ACTIONS-SETUP.md"></mcfile>

---

## 🚀 Workflow de Deploy Automatizado

Agora você tem **3 opções** para fazer deploy das suas alterações:

---

## 📋 **Alternativas de Deploy Manual**

### Opção 1: Script Rápido
```bash
./deploy-quick.bat  # Windows
./deploy-quick.sh   # Linux/Mac
```

### Opção 2: Docker Compose
```bash
./deploy-compose.sh
```

### Opção 3: Comandos Manuais
```bash
docker build -t projetogran-app:latest .
docker save projetogran-app:latest | ssh root@46.202.146.234 "docker load"
# ... resto dos comandos
```

---

---

## ⚡ Script Automatizado

### 📄 **Criar arquivo `deploy-quick.sh`:**
```bash
#!/bin/bash
echo "🚀 Iniciando deploy rápido..."

# 1. Build da imagem
echo "🔧 Fazendo build da imagem..."
docker build -t projetogran-app:latest .

# 2. Enviar para servidor
echo "📤 Enviando para servidor..."
docker save projetogran-app:latest | ssh root@46.202.146.234 "docker load"

# 3. Atualizar container
echo "🔄 Atualizando container..."
ssh root@46.202.146.234 "
  docker stop projetogran-app-fixed-final 2>/dev/null || true &&
  docker rm projetogran-app-fixed-final 2>/dev/null || true &&
  docker run -d --name projetogran-app-fixed-final -p 3001:3000 \
    -e DATABASE_URL='file:./dev.db' \
    -e JWT_SECRET='gran-system-jwt-secret-key-2024' \
    -e NEXTAUTH_URL='http://localhost:3000' \
    -e NODE_ENV='development' \
    projetogran-app:latest
"

echo "✅ Deploy concluído!"
echo "🌐 Aplicação disponível em: http://46.202.146.234:3001"
```

### 🎯 **Usar o script:**
```bash
# Dar permissão
chmod +x deploy-quick.sh

# Executar deploy
./deploy-quick.sh
```

---

## 🔧 Alternativa: Docker Compose

### 📄 **Atualizar `docker-compose.yml`:**
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3001:3000"
    environment:
      - DATABASE_URL=file:./dev.db
      - JWT_SECRET=gran-system-jwt-secret-key-2024
      - NEXTAUTH_URL=http://localhost:3000
      - NODE_ENV=development
    container_name: projetogran-app-fixed-final
```

### 🚀 **Deploy com Compose:**
```bash
# Enviar docker-compose.yml para servidor
scp docker-compose.yml root@46.202.146.234:/root/

# Deploy no servidor
ssh root@46.202.146.234 "
  cd /root &&
  docker-compose down &&
  docker-compose up -d --build
"
```

---

## 🎯 Resumo do Workflow

### **Para cada alteração:**
1. ✏️ **Edite** os arquivos localmente
2. 🔧 **Execute** `./deploy-quick.sh`
3. ⏱️ **Aguarde** ~2-3 minutos
4. ✅ **Teste** em http://46.202.146.234:3001

### **Vantagens:**
- ✅ Alterações refletidas automaticamente
- ✅ Mantém configurações corretas
- ✅ Preserva banco de dados
- ✅ Um comando só para deploy

---

## 🔍 Verificar Status

```bash
# Status do container
ssh root@46.202.146.234 "docker ps | grep projetogran"

# Logs do container
ssh root@46.202.146.234 "docker logs projetogran-app-fixed-final"

# Testar API
curl http://46.202.146.234:3001/api/auth/login
```

---

## 🎉 Pronto!
Agora você tem um workflow completo para desenvolver localmente e fazer deploy automático no servidor! 🚀

## 📊 Status Atual
- ✅ **Aplicação**: Deployada com sucesso
- ✅ **Docker**: Containers rodando (app, nginx, db)
- ❌ **Porta 3000**: Bloqueada pelo firewall/provedor
- 🔄 **Domínio**: granhub.com.br aponta para outro app PHP

## 🎯 Opções de Acesso

### 1. 🌟 **RECOMENDADO: Subdomínio**
Criar um subdomínio para sua aplicação Next.js:

**Configuração no CyberPanel:**
1. Acesse CyberPanel: `https://46.202.146.234:8090`
2. Vá em **Websites** → **Create Website**
3. Configure:
   - **Domain**: `app.granhub.com.br` (ou `projetogran.granhub.com.br`)
   - **Owner**: cyberpanel
   - **Package**: Default
4. Após criar, vá em **Websites** → **List Websites**
5. Clique no subdomínio criado → **Manage** → **Rewrite Rules**
6. Configure proxy reverso:
```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**DNS (no painel do domínio):**
- Adicione registro A: `app` → `46.202.146.234`

### 2. 📁 **Diretório no Domínio Principal**
Acessar via `granhub.com.br/app`:

**Configuração no CyberPanel:**
1. Vá no website `granhub.com.br`
2. **Manage** → **Rewrite Rules**
3. Adicione:
```nginx
location /app {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 3. 🔧 **Porta Específica (Temporário)**
Usar uma porta alternativa como 8080:

**Comandos no servidor:**
```bash
# Parar container atual
docker stop projetogran-app-1

# Rodar na porta 8080
docker run -d --name projetogran-app-8080 \
  -p 8080:3000 \
  -v /home/cyberpanel/projetogran/prisma:/app/prisma \
  -v /home/cyberpanel/projetogran/uploads:/app/uploads \
  --env-file /home/cyberpanel/projetogran/.env.production \
  projetogran-app:latest
```

**Acesso:** `http://46.202.146.234:8080`

## 🚀 Próximos Passos

### Imediato:
1. **Teste a Opção 1 (Subdomínio)** - Mais profissional
2. Configure SSL após o acesso funcionar
3. Teste todas as funcionalidades

### Configuração DNS:
- Acesse o painel do seu provedor de domínio
- Adicione o registro A para o subdomínio
- Aguarde propagação (até 24h)

### Verificação:
```bash
# Testar se a aplicação responde internamente
ssh root@46.202.146.234 "curl -I http://127.0.0.1:3000"

# Verificar containers
ssh root@46.202.146.234 "docker ps"
```

## 🔍 Troubleshooting

### Se não funcionar:
1. Verifique se os containers estão rodando
2. Teste acesso interno (127.0.0.1:3000)
3. Verifique logs: `docker logs projetogran-app-1`
4. Confirme configuração do proxy reverso

### Logs úteis:
```bash
# Logs da aplicação
docker logs projetogran-app-1 -f

# Logs do Nginx
docker logs projetogran-nginx-1 -f

# Status dos containers
docker ps -a
```

## 📞 Suporte
Se precisar de ajuda com qualquer configuração, me informe qual opção você escolheu e eu te ajudo com os detalhes específicos!