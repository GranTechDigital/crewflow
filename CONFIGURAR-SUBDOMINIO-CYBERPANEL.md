# 🌐 Configurar Subdomínio no CyberPanel - Passo a Passo

## 📋 **Informações Importantes**
- **IP do Servidor**: `46.202.146.234`
- **CyberPanel**: `https://46.202.146.234:8090`
- **Aplicação**: Rodando em `127.0.0.1:3000` (interno)
- **Domínio Principal**: `granhub.com.br`
- **Subdomínio Sugerido**: `app.granhub.com.br`

## 🚀 **PASSO 1: Acessar CyberPanel**

### Opção A: Via HTTPS (Recomendado)
```
https://46.202.146.234:8090
```

### Opção B: Via HTTP (se HTTPS não funcionar)
```
http://46.202.146.234:8090
```

### Credenciais:
- **Usuário**: `admin` (ou conforme configurado)
- **Senha**: Verifique no servidor com: `cat /etc/cyberpanel/machineIP`

## 🌟 **PASSO 2: Criar Website/Subdomínio**

1. **Login no CyberPanel**
2. **Menu Lateral** → **Websites** → **Create Website**
3. **Preencher Formulário:**
   - **Select Domain**: `granhub.com.br`
   - **Enter Child Domain**: `flux` *(apenas o nome, sem o domínio completo)*
   - **Select Owner**: `cyberpanel`
   - **Select Package**: `Default`
   - **Select PHP**: `PHP 8.1` (ou mais recente)
4. **Clicar**: `Create Website`

### **⚠️ IMPORTANTE - Resolução do Erro "Invalid domain":**
- **Use APENAS**: `flux` (não `flux.granhub.com.br`)
- **Certifique-se** que `granhub.com.br` está selecionado como website principal
- **Se o erro persistir**: Primeiro crie `granhub.com.br` como website principal

## 🔧 **PASSO 3: Configurar Proxy Reverso**

1. **Websites** → **List Websites**
2. **Encontrar**: `app.granhub.com.br`
3. **Clicar**: `Manage`
4. **Menu Lateral** → **Rewrite Rules**
5. **Adicionar as regras:**

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Port $server_port;
    proxy_redirect off;
}
```

6. **Clicar**: `Save Rewrite Rules`

## 🌍 **PASSO 4: Configurar DNS**

### No Painel do seu Provedor de Domínio:
1. **Acessar**: Painel de controle do domínio `granhub.com.br`
2. **DNS Management** ou **Gerenciar DNS**
3. **Adicionar Registro A:**
   - **Nome/Host**: `app`
   - **Tipo**: `A`
   - **Valor/IP**: `46.202.146.234`
   - **TTL**: `3600` (1 hora)
4. **Salvar** as alterações

## 🔒 **PASSO 5: Configurar SSL (Após DNS Propagar)**

1. **CyberPanel** → **SSL** → **Manage SSL**
2. **Selecionar**: `app.granhub.com.br`
3. **Clicar**: `Issue SSL`
4. **Aguardar**: Processo de emissão (Let's Encrypt)

## ✅ **PASSO 6: Verificar Funcionamento**

### Testes Internos (no servidor):
```bash
# Testar aplicação
curl -I http://127.0.0.1:3000

# Testar containers
docker ps | grep projetogran
```

### Testes Externos (após DNS propagar):
```bash
# Testar subdomínio
curl -I http://app.granhub.com.br

# Com SSL (após configurar)
curl -I https://app.granhub.com.br
```

## 🕐 **Tempo de Propagação DNS**
- **Mínimo**: 1-2 horas
- **Máximo**: 24-48 horas
- **Verificar**: `nslookup app.granhub.com.br`

## 🔍 **Troubleshooting**

### Se CyberPanel não abrir:
```bash
# Verificar se está rodando
systemctl status lscpd

# Reiniciar se necessário
systemctl restart lscpd
```

### Se aplicação não responder:
```bash
# Verificar containers
docker ps

# Verificar logs
docker logs projetogran-app-1

# Reiniciar se necessário
docker restart projetogran-app-1
```

### Se SSL falhar:
1. Aguardar propagação DNS completa
2. Tentar novamente após 2-4 horas
3. Verificar se domínio aponta corretamente

## 📞 **Comandos Úteis**

### Verificar Status da Aplicação:
```bash
ssh root@46.202.146.234 "docker ps && curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000"
```

### Verificar DNS:
```bash
nslookup app.granhub.com.br
dig app.granhub.com.br
```

### Logs do CyberPanel:
```bash
tail -f /usr/local/lsws/logs/error.log
tail -f /usr/local/lsws/logs/access.log
```

## 🎯 **Resultado Final**

Após completar todos os passos:
- ✅ **URL**: `https://app.granhub.com.br`
- ✅ **SSL**: Certificado válido
- ✅ **Aplicação**: Funcionando perfeitamente
- ✅ **Performance**: Otimizada com proxy reverso

## 📝 **Notas Importantes**

1. **Backup**: Sempre faça backup antes de mudanças
2. **Teste**: Teste em ambiente de desenvolvimento primeiro
3. **Monitoramento**: Configure alertas para uptime
4. **Segurança**: Mantenha CyberPanel atualizado

---

**🚀 Sua aplicação ProjetoGran estará acessível em `https://app.granhub.com.br`!**