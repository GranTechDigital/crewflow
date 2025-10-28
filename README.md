# CrewFlow - Sistema de Gestão Integrada

Sistema de gestão desenvolvido em Next.js para controle de funcionários, remanejamentos, tarefas e administração.

🔄 **Deploy Automático Ativo** - Última atualização: $(date)

## 📚 Documentação de Infraestrutura e Deploy

### 🏗️ Arquitetura do Sistema

O sistema utiliza uma arquitetura baseada em containers Docker com os seguintes componentes:

| Componente | Nome do Container | Porta | Descrição |
|------------|-------------------|-------|-----------|
| Aplicação | `crewflow-app-production` | 3001:3000 | Aplicação Next.js principal |
| Banco de Dados | `postgres-prod` | 5434:5432 | PostgreSQL para ambiente de produção |
| Interface BD | `pgadmin-production` | 5050:80 | pgAdmin para gerenciamento do banco |

### 🌐 Ambientes

| Ambiente | URL | Descrição |
|----------|-----|-----------|
| Produção | http://46.202.146.234:3001 | Ambiente de produção |
| Staging | Local | Ambiente de testes com PostgreSQL local |
| Desenvolvimento | Local | Ambiente de desenvolvimento com PostgreSQL |

### 🚀 Processo de Deploy

#### Deploy Automático (GitHub Actions)

O deploy é realizado automaticamente pelo GitHub Actions quando há um push para a branch `main`:

1. Constrói a imagem Docker `crewflow-app:latest`
2. Envia a imagem para o servidor via SSH e faz o `docker load`
3. Faz backup do banco de dados (`pg_dump -Fc`) ANTES de iniciar o deploy
4. Para e remove containers antigos e sobe a nova versão
5. Aplica migrações do Prisma e executa seed idempotente

#### Configuração da Rede Docker

```bash
# Rede utilizada pelos containers
docker network create projetogran_crewflow-network
```

#### Variáveis de Ambiente e Segredos (Produção)

- A aplicação recebe segredos via GitHub Secrets, injetados no `docker run`:
  - `PRODUCTION_DATABASE_URL`
  - `JWT_SECRET_PRODUCTION`
  - `SERVER_HOST`
- O workflow gera/atualiza um arquivo `/opt/projetogran/.env` no servidor contendo SOMENTE credenciais do Postgres/pgAdmin utilizadas pelo `docker-compose.yml` (não pela aplicação):
  - `POSTGRES_PROD_DB`, `POSTGRES_PROD_USER`, `POSTGRES_PROD_PASSWORD`
  - `PGADMIN_PROD_EMAIL`, `PGADMIN_PROD_PASSWORD`
- Não existem credenciais hardcoded no repositório.

Exemplo de `DATABASE_URL` (apenas formato):
```
postgresql://<user>:<password>@<host>:<port>/<db>?schema=public
```

### 🛠️ Scripts de Manutenção

#### Deploy Rápido (Emergencial)

O script `deploy-quick.bat` pode ser usado para fazer um deploy rápido em caso de emergência:

```bash
# Execução do script de deploy rápido
./deploy-quick.bat
```

> ⚠️ Atenção: Use apenas em situações de emergência. O método recomendado é o deploy via GitHub Actions.

#### Inicialização do PostgreSQL Local (Staging)

Para iniciar o PostgreSQL local para testes:

```bash
# Iniciar PostgreSQL para ambiente de staging
./start-postgres.bat
```

### Desenvolvimento Local com Docker

Você pode rodar a aplicação localmente de dois modos, sem impactar staging ou produção:

1) Modo produção-like (app-local, Next.js com `next start`)
- Uso: valida build, cookies, middleware e autenticação como em produção.
- Como subir:
```bash
# sobe somente o app-local (usa a imagem crewflow-app:latest)
docker-compose -f docker-compose.local.yml up -d app-local
```
- Quando mudar código, precisa rebuildar a imagem e recriar o contêiner:
```bash
docker build -t crewflow-app:latest .
docker-compose -f docker-compose.local.yml up -d --force-recreate --no-deps app-local
```
- Não precisa rebuild para rodar migrações ou seeds:
```bash
docker exec crewflow-app-local npx prisma migrate deploy
docker exec crewflow-app-local npm run seed
```

2) Modo desenvolvimento com hot-reload (app-dev, Next.js com `npm run dev`)
- Uso: editar código e ver mudanças instantaneamente, sem rebuild.
- Como subir:
```bash
# garanta que o postgres-staging esteja ativo
# depois suba o serviço de desenvolvimento
docker-compose -f docker-compose.local.yml up -d app-dev
```
- A aplicação ficará acessível em http://localhost:3000 e atualizará ao salvar arquivos.
- Para evitar conflitos de porta, rode SOMENTE um dos serviços (app-local OU app-dev) por vez:
```bash
# parar tudo do compose local
docker-compose -f docker-compose.local.yml down
# subir o modo desejado
# app-local (produção-like):
docker-compose -f docker-compose.local.yml up -d app-local
# app-dev (hot-reload):
docker-compose -f docker-compose.local.yml up -d app-dev
```

Notas importantes:
- Ambos os serviços reutilizam a rede externa `projetogran_crewflow-network` e o container `postgres-staging` já existente.
- Mantemos apenas os compose essenciais: `docker-compose.yml` (produção) e `docker-compose.staging-postgres.yml` (staging).
- No Windows/Docker Desktop, `CHOKIDAR_USEPOLLING=true` está habilitado no app-dev para o watch funcionar corretamente.
- Se o `schema.prisma` mudar, o Prisma Client precisa ser gerado. No app-dev isso ocorre automaticamente via `npx prisma generate`; no app-local, o generate roda no `docker build`.

#### Comandos rápidos (Windows)
- Desenvolvimento (hot-reload):
  - start-app-dev.bat
- Produção-like:
  - start-app-local.bat
- Rebuild da imagem e restart do produção-like:
  - rebuild-app-local.bat
- Abrir o app no navegador:
  - open-app.bat

Dicas:
- Você pode executar os .bat clicando duas vezes no Explorer ou pelo terminal com:
  - cmd /c start-app-dev.bat
  - cmd /c start-app-local.bat
- Rode apenas um serviço por vez para evitar conflito na porta 3000.

#### Comandos npm (atalhos oficiais)
- Alternar para produção-like:
  - npm run producao-like
- Alternar para desenvolvimento com Docker (hot-reload):
  - npm run dev:docker
- Rebuild da imagem e recriar produção-like:
  - npm run producao-like:rebuild
- Derrubar tudo do compose local:
  - npm run compose:down
- Ver logs:
  - npm run logs:dev
  - npm run logs:producao-like
- Abrir o app no navegador:
  - npm run open
- Prisma (opcionais):
  - npm run prisma:dev
  - npm run prisma:prod
- Seed da Matriz (manual):
  - npm run seed:matriz
 
 
 ### 📋 Checklist de Verificação de Deploy

Após um deploy, verifique:

1. ✅ Aplicação acessível em http://46.202.146.234:3001
2. ✅ Banco de dados PostgreSQL rodando na porta 5434
3. ✅ pgAdmin acessível em http://46.202.146.234:5050
4. ✅ Todos os containers na mesma rede Docker `projetogran_crewflow-network`
5. ✅ Logs da aplicação sem erros

### 🔄 Histórico de Versões da Infraestrutura

| Data | Versão | Descrição |
|------|--------|-----------|
| 2024-05-XX | 1.0 | Configuração inicial |
| 2024-05-XX | 1.1 | Migração para PostgreSQL |
| 2024-05-XX | 1.2 | Padronização dos nomes dos containers |
| 2024-05-XX | 1.3 | Correção do workflow de deploy automático |
| 2025-10-XX | 1.4 | Externalização de segredos (staging e produção) e backup obrigatório antes do deploy |

### 🔍 Solução de Problemas Comuns

| Problema | Possível Causa | Solução |
|----------|----------------|---------|
| Site não acessível | Container da aplicação parado | Verificar status com `docker ps` e reiniciar se necessário |
| Erro de conexão com banco | PostgreSQL não iniciado ou credenciais incorretas | Verificar status do container `postgres-prod` e configurações de ambiente |
| Falha no deploy automático | Inconsistência nos nomes dos arquivos/containers | Verificar logs do GitHub Actions e corrigir o workflow |
| Dados não persistindo | Volume do PostgreSQL não configurado | Verificar se o volume `postgres_data` está mapeado corretamente |
| pgAdmin inacessível | Container não iniciado ou porta incorreta | Verificar status do container `pgadmin-production` e mapeamento de porta |

### 🧹 Limpeza de Remanejamentos (Staging) — Desativado

A partir de agora, qualquer limpeza de dados deve ser feita manualmente via pgAdmin, tanto em produção quanto em staging. Antes de cada deploy realizado via GitHub Actions, um backup completo do banco é criado automaticamente:

- Staging: `/var/backups/projetogran/staging/projetogran_YYYYMMDD_HHMMSS.dump`
- Produção: `/var/backups/projetogran/producao/crewflow_production_YYYYMMDD_HHMMSS.dump`

Não use scripts de limpeza pela aplicação; execute operações destrutivas apenas pelo pgAdmin com confirmação manual.

### 🧱 Padronização de Volumes (Docker)
- Staging: usar sempre os volumes `postgres-staging-data` e `pgadmin-staging-data` (compose: `docker-compose.staging-postgres.yml`).
- Produção: manter volumes legados `postgres_data` e `pgadmin_data` até migração planejada com backup e janela de manutenção. Quando oportuno, aplicar a mesma estratégia de auditoria/migração utilizada em staging (com dry-run e backup antes).
- Rede: `projetogran_crewflow-network` compartilhada entre app e banco em todos os ambientes.
- Dica: valide volumes em uso no servidor com `docker inspect <container> | grep Source` antes de qualquer limpeza.

### 🛡️ Guard Rails de Deploy e Backup
- Backups obrigatórios e verificados: staging e produção realizam `pg_dump -Fc` com checagens de container, conexão ao DB e tamanho do arquivo (>0 bytes) antes do deploy.
- Sem segredos hardcoded em compose/workflows; uso de Secrets e `.env` no servidor.
