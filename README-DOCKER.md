# Deploy com Docker no CyberPanel (Hostinger VPS)

## Pré-requisitos

1. **VPS com CyberPanel instalado**
2. **Docker e Docker Compose instalados**
3. **Git instalado**
4. **Domínio configurado no CyberPanel**

## Instalação do Docker (se não estiver instalado)

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER
```

## Configuração Inicial

### 1. Clonar o repositório
```bash
cd /home/cyberpanel/public_html/seu-dominio.com
git clone https://github.com/seu-usuario/projetogran.git .
```

### 2. Configurar variáveis de ambiente
```bash
# Copiar arquivo de produção
cp .env.production .env

# Editar com suas configurações
nano .env
```

### 3. Configurar SSL no CyberPanel
1. Acesse o CyberPanel
2. Vá em **SSL** > **Issue SSL**
3. Selecione seu domínio
4. Escolha **Let's Encrypt**
5. Copie os certificados para a pasta `ssl/`

```bash
# Criar pasta SSL
mkdir ssl

# Copiar certificados (ajuste os caminhos conforme necessário)
sudo cp /etc/letsencrypt/live/seu-dominio.com/fullchain.pem ./ssl/cert.pem
sudo cp /etc/letsencrypt/live/seu-dominio.com/privkey.pem ./ssl/key.pem
sudo chown $USER:$USER ./ssl/*
```

### 4. Ajustar configurações do Nginx
```bash
# Editar nginx.conf
nano nginx.conf

# Substituir "seu-dominio.com" pelo seu domínio real
```

### 5. Configurar banco de dados
```bash
# Editar docker-compose.yml
nano docker-compose.yml

# Alterar senha do PostgreSQL
# Alterar DATABASE_URL no .env
```

## Deploy

### Primeira execução
```bash
# Dar permissão ao script
chmod +x deploy.sh

# Executar deploy
./deploy.sh
```

### Atualizações futuras
```bash
# Simplesmente execute o script novamente
./deploy.sh
```

## Comandos Úteis

### Verificar status dos containers
```bash
docker-compose ps
```

### Ver logs da aplicação
```bash
docker-compose logs app
```

### Ver logs do banco
```bash
docker-compose logs db
```

### Acessar container da aplicação
```bash
docker-compose exec app sh
```

### Backup do banco de dados
```bash
docker-compose exec db pg_dump -U postgres projetogran > backup.sql
```

### Restaurar banco de dados
```bash
docker-compose exec -T db psql -U postgres projetogran < backup.sql
```

## Configuração no CyberPanel

### 1. Criar Website
1. Acesse CyberPanel
2. **Websites** > **Create Website**
3. Adicione seu domínio
4. Configure SSL

### 2. Configurar Proxy Reverso
1. **Websites** > **List Websites**
2. Clique em **Manage** no seu domínio
3. **Rewrite Rules**
4. Adicione:
```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

## Monitoramento

### Verificar se a aplicação está rodando
```bash
curl http://localhost:3000
```

### Verificar uso de recursos
```bash
docker stats
```

### Logs em tempo real
```bash
docker-compose logs -f
```

## Troubleshooting

### Container não inicia
```bash
# Ver logs detalhados
docker-compose logs app

# Verificar configurações
docker-compose config
```

### Problemas de permissão
```bash
# Ajustar permissões
sudo chown -R $USER:$USER .
```

### Banco não conecta
```bash
# Verificar se PostgreSQL está rodando
docker-compose ps db

# Testar conexão
docker-compose exec app npx prisma db push
```

## Backup e Restauração

### Backup completo
```bash
# Criar backup
tar -czf backup-$(date +%Y%m%d).tar.gz . --exclude=node_modules --exclude=.git

# Backup do banco
docker-compose exec db pg_dump -U postgres projetogran > db-backup-$(date +%Y%m%d).sql
```

### Restauração
```bash
# Restaurar arquivos
tar -xzf backup-YYYYMMDD.tar.gz

# Restaurar banco
docker-compose exec -T db psql -U postgres projetogran < db-backup-YYYYMMDD.sql
```

## Segurança

1. **Altere todas as senhas padrão**
2. **Configure firewall**
3. **Mantenha o sistema atualizado**
4. **Use HTTPS sempre**
5. **Faça backups regulares**

## Suporte

Para problemas específicos:
1. Verifique os logs: `docker-compose logs`
2. Verifique o status: `docker-compose ps`
3. Reinicie se necessário: `docker-compose restart`