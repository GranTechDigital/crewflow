# 🚀 GitHub Actions - Deploy Automático

## 📋 Como Funciona

O **GitHub Actions** automatiza o deploy sempre que você fizer `git push` para o repositório. Não precisa mais executar scripts manuais!

### 🔄 **Fluxo Automático:**
1. **Push** → Você faz `git push` 
2. **Build** → GitHub Actions constrói a imagem Docker
3. **Deploy** → Envia e atualiza no servidor automaticamente
4. **Pronto** → Aplicação atualizada em ~3-5 minutos

---

## ⚙️ **Configuração (Uma vez só)**

### 1. 🔑 **Configurar Secrets no GitHub**

Acesse: **Seu Repositório** → **Settings** → **Secrets and variables** → **Actions**

Adicione estes **Repository Secrets**:

| Nome | Valor | Descrição |
|------|-------|-----------|
| `SSH_PRIVATE_KEY` | `[sua chave SSH privada]` | Chave para acessar o servidor |
| `SERVER_HOST` | `46.202.146.234` | IP do seu servidor |

### 2. 🔐 **Gerar Chave SSH (se não tiver)**

No seu computador:
```bash
# Gerar nova chave SSH
ssh-keygen -t rsa -b 4096 -C "github-actions"

# Copiar chave pública para o servidor
ssh-copy-id root@46.202.146.234

# Copiar chave privada (para o GitHub Secret)
cat ~/.ssh/id_rsa
```

### 3. 📁 **Estrutura Criada**

O arquivo <mcfile name="deploy.yml" path="c:\Users\luanx\projetogran\.github\workflows\deploy.yml"></mcfile> foi criado com:

- ✅ **Build automático** da imagem Docker
- ✅ **Upload** para o servidor via SSH
- ✅ **Deploy** com zero downtime
- ✅ **Verificação** se o container iniciou
- ✅ **Seed** opcional (se necessário)

---

## 🎯 **Como Usar**

### **Opção 1: Push Automático**
```bash
# Faça suas alterações
git add .
git commit -m "Nova funcionalidade"
git push origin main

# 🎉 Deploy acontece automaticamente!
```

### **Opção 2: Deploy Manual**
1. Acesse **Actions** no GitHub
2. Clique em **Deploy to Server**
3. Clique **Run workflow**
4. Aguarde ~3-5 minutos

---

## 📊 **Monitoramento**

### **Ver Progresso:**
- Acesse **Actions** no seu repositório GitHub
- Clique no workflow em execução
- Acompanhe cada etapa em tempo real

### **Logs Detalhados:**
```bash
# Ver logs do container
ssh root@46.202.146.234 "docker logs projetogran-app-fixed-final"

# Status do container
ssh root@46.202.146.234 "docker ps | grep projetogran"
```

---

## 🔧 **Configurações Avançadas**

### **Deploy apenas em branches específicas:**
```yaml
on:
  push:
    branches: [ main, production ]  # Apenas main e production
```

### **Deploy com aprovação manual:**
```yaml
jobs:
  deploy:
    environment: production  # Requer aprovação
    runs-on: ubuntu-latest
```

### **Notificações no Slack/Discord:**
```yaml
- name: 📢 Notify Slack
  if: success()
  uses: 8398a7/action-slack@v3
  with:
    status: success
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 🆚 **Comparação: Manual vs GitHub Actions**

| Aspecto | Manual | GitHub Actions |
|---------|--------|----------------|
| **Tempo** | ~5 min + sua atenção | ~3 min automático |
| **Esforço** | Executar script toda vez | Zero (após setup) |
| **Confiabilidade** | Depende de você | Sempre igual |
| **Histórico** | Nenhum | Logs completos |
| **Rollback** | Manual | Automático |
| **Notificações** | Nenhuma | Email/Slack |

---

## 🛠️ **Troubleshooting**

### **Erro de SSH:**
```bash
# Verificar conexão SSH
ssh root@46.202.146.234 "echo 'Conexão OK'"

# Regenerar chaves se necessário
ssh-keygen -R 46.202.146.234
```

### **Erro de Build:**
- Verifique se o `Dockerfile` está correto
- Veja os logs no GitHub Actions

### **Container não inicia:**
- Verifique as variáveis de ambiente
- Veja logs: `docker logs projetogran-app-fixed-final`

---

## 🎉 **Vantagens do GitHub Actions**

1. **🔄 Deploy Automático** - Push e pronto!
2. **📊 Histórico Completo** - Todos os deploys registrados
3. **🔒 Seguro** - Secrets criptografados
4. **📧 Notificações** - Email quando falha/sucede
5. **🌍 Gratuito** - 2000 minutos/mês grátis
6. **🔄 Rollback Fácil** - Voltar para commit anterior
7. **👥 Colaboração** - Toda equipe pode fazer deploy

---

## 📝 **Próximos Passos**

1. **Configure os Secrets** no GitHub
2. **Faça um push** para testar
3. **Monitore** o primeiro deploy
4. **Desative** os scripts manuais (opcional)

**Resultado:** Deploy automático sempre que você fizer `git push`! 🚀