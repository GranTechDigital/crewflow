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
2. Salva a imagem como `crewflow-app.tar`
3. Envia os arquivos para o servidor via SSH
4. Para e remove os containers existentes
5. Inicia os novos containers com a versão atualizada

#### Configuração da Rede Docker

```bash
# Rede utilizada pelos containers
docker network create projetogran_crewflow-network
```

#### Variáveis de Ambiente de Produção

```env
# Banco de dados
DATABASE_URL="postgresql://crewflow_user:crewflow_production_2024@postgres-prod:5432/crewflow_production"

# JWT Secret
JWT_SECRET="crewflow-jwt-secret-key-2024"

# URL da aplicação
NEXTAUTH_URL="http://localhost:3000"

# Ambiente
NODE_ENV="production"
```

### 🛠️ Scripts de Manutenção

#### Deploy Rápido (Emergencial)

O script `deploy-quick.bat` pode ser usado para fazer um deploy rápido em caso de emergência:

```bash
# Execução do script de deploy rápido
./deploy-quick.bat
```

> ⚠️ **Atenção**: Use apenas em situações de emergência. O método recomendado é o deploy via GitHub Actions.

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
- Não há impacto em staging/produção: nada muda nos arquivos `docker-compose.staging.yml` ou de produção.
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

### 🔍 Solução de Problemas Comuns

| Problema | Possível Causa | Solução |
|----------|----------------|---------|
| Site não acessível | Container da aplicação parado | Verificar status com `docker ps` e reiniciar se necessário |
| Erro de conexão com banco | PostgreSQL não iniciado ou credenciais incorretas | Verificar status do container `postgres-prod` e configurações de ambiente |
| Falha no deploy automático | Inconsistência nos nomes dos arquivos/containers | Verificar logs do GitHub Actions e corrigir o workflow |
| Dados não persistindo | Volume do PostgreSQL não configurado | Verificar se o volume `postgres_data` está mapeado corretamente |
| pgAdmin inacessível | Container não iniciado ou porta incorreta | Verificar status do container `pgadmin-production` e mapeamento de porta |

### 🧹 Limpeza de Remanejamentos (Staging)

A limpeza remove dados de remanejamentos e reseta `emMigracao` em funcionários. Use somente no ambiente de staging.

- O que é limpo:
  - `ObservacaoTarefaRemanejamento`, `HistoricoRemanejamento`, `TarefaRemanejamento`, `RemanejamentoFuncionario`, `SolicitacaoRemanejamento`
  - `Funcionario.emMigracao` é definido como `false`

- Verificar antes (contagem de registros):
  - `ssh root@46.202.146.234 "docker exec postgres-staging psql -U postgres -d projetogran -c \"SELECT 'ObservacaoTarefaRemanejamento' as tabela, COUNT(*) as total FROM public.\\\"ObservacaoTarefaRemanejamento\\\" UNION ALL SELECT 'HistoricoRemanejamento', COUNT(*) FROM public.\\\"HistoricoRemanejamento\\\" UNION ALL SELECT 'TarefaRemanejamento', COUNT(*) FROM public.\\\"TarefaRemanejamento\\\" UNION ALL SELECT 'RemanejamentoFuncionario', COUNT(*) FROM public.\\\"RemanejamentoFuncionario\\\" UNION ALL SELECT 'SolicitacaoRemanejamento', COUNT(*) FROM public.\\\"SolicitacaoRemanejamento\\\";\""`

- Executar limpeza via SSH (transação SQL):
  - `ssh root@46.202.146.234 "docker exec postgres-staging psql -U postgres -d projetogran -c \"BEGIN; DELETE FROM public.\\\"ObservacaoTarefaRemanejamento\\\"; DELETE FROM public.\\\"HistoricoRemanejamento\\\"; DELETE FROM public.\\\"TarefaRemanejamento\\\"; DELETE FROM public.\\\"RemanejamentoFuncionario\\\"; DELETE FROM public.\\\"SolicitacaoRemanejamento\\\"; UPDATE public.\\\"Funcionario\\\" SET \\\"emMigracao\\\" = false WHERE \\\"emMigracao\\\" = true; COMMIT;\""` 

- Executar via script no container da aplicação:
  - Preferencial (CommonJS): `ssh root@46.202.146.234 "docker exec crewflow-app-staging node scripts/cleanup-remanejamentos.cjs"`
  - Caso o container tenha apenas `.js` e o projeto esteja com `"type": "module"`, use o `.cjs` ou converta o script para ES Modules.

- Verificar após a limpeza:
  - `ssh root@46.202.146.234 "docker exec postgres-staging psql -U postgres -d projetogran -c \"SELECT 'ObservacaoTarefaRemanejamento' as tabela, COUNT(*) as total FROM public.\\\"ObservacaoTarefaRemanejamento\\\" UNION ALL SELECT 'HistoricoRemanejamento', COUNT(*) FROM public.\\\"HistoricoRemanejamento\\\" UNION ALL SELECT 'TarefaRemanejamento', COUNT(*) FROM public.\\\"TarefaRemanejamento\\\" UNION ALL SELECT 'RemanejamentoFuncionario', COUNT(*) FROM public.\\\"RemanejamentoFuncionario\\\" UNION ALL SELECT 'SolicitacaoRemanejamento', COUNT(*) FROM public.\\\"SolicitacaoRemanejamento\\\" UNION ALL SELECT 'Funcionarios em Migracao', COUNT(*) FROM public.\\\"Funcionario\\\" WHERE \\\"emMigracao\\\" = true;\""`
  - UI: `http://46.202.146.234:3002/prestserv/remanejamentos` e `http://46.202.146.234:3002/prestserv/remanejamentos/tabela`

- Alternativa via GitHub Actions:
  - Workflow manual: "Cleanup Remanejamentos (Staging)" (`.github/workflows/cleanup-staging-remanejamentos.yml`)
  - Acessar a aba Actions, selecionar o workflow e clicar em "Run workflow"

- Observações importantes:
  - Operação destrutiva. Confirme o ambiente (`staging`) e `DATABASE_URL` antes de executar.
  - Se usar a rota HTTP administrativa (`POST /api/admin/cleanup-remanejamentos`), configure `CLEANUP_ADMIN_TOKEN` via segredo do GitHub e injete no container.

## 🚀 Tecnologias Utilizadas

- **Next.js 14** - Framework React
- **TypeScript** - Linguagem de programação
- **Prisma** - ORM para banco de dados
- **PostgreSQL** - Banco de dados
- **Tailwind CSS** - Framework CSS
- **JWT** - Autenticação
- **Lucide React** - Ícones

## 📋 Pré-requisitos

- Node.js 18+ instalado
- npm, yarn, pnpm ou bun
- Git

## 🔧 Instalação e Configuração

### 1. Clone o repositório
```bash
git clone https://github.com/GranTechDigital/crewflow.git
cd crewflow
```

### 2. Instale as dependências
```bash
npm install
# ou
yarn install
# ou
pnpm install
```

### 3. Configure as variáveis de ambiente
Crie um arquivo `.env` na raiz do projeto:
```env
# Banco de dados
DATABASE_URL="postgresql://postgres:senha_segura_aqui@localhost:5432/projetogran?schema=public"

# JWT Secret (altere para um valor seguro em produção)
JWT_SECRET="seu-jwt-secret-aqui"

# URL da aplicação
NEXTAUTH_URL="http://localhost:3000"
```

### 4. Configure o banco de dados
```bash
# Gerar o cliente Prisma
npx prisma generate

# Executar as migrações
npx prisma migrate dev

# Popular o banco com dados iniciais
npm run seed
```

### 5. Inicie o servidor de desenvolvimento
```bash
npm run dev
# ou
yarn dev
# ou
pnpm dev
```

Acesse [http://localhost:3000](http://localhost:3000) no seu navegador.

## 🔐 Credenciais de Acesso

### Usuário Administrador
- **Matrícula:** `ADMIN001`
- **Senha:** `admin123`
- **Permissões:** Acesso total ao sistema

## 📁 Estrutura do Projeto

```
# Sistema de Proteção de Rotas - Centralizado

## 🔐 **Sistema Centralizado de Permissões**

### **📁 Arquivo Central:**
- **`src/lib/permissions.ts`** - Sistema centralizado de permissões

### **🎯 Permissões Padronizadas:**

#### **🔧 Permissões de Administração:**
- `admin` - Acesso total ao sistema
- `gerenciar_usuarios` - Gerenciar usuários
- `gerenciar_equipes` - Gerenciar equipes

#### **📋 Permissões de Acesso por Módulo:**
- `canAccessFuncionarios` - Acesso a funcionários
- `canAccessPrestServ` - Acesso ao Prestserv
- `canAccessPlanejamento` - Acesso ao Planejamento
- `canAccessLogistica` - Acesso à Logística
- `canAccessAdmin` - Acesso à Administração
- `canAccessRH` - Acesso ao RH
- `canAccessTreinamento` - Acesso ao Treinamento
- `canAccessMedicina` - Acesso à Medicina

### **🏢 Mapeamento de Equipes:**

```typescript
TEAM_PERMISSIONS = {
  'Administração': [
    'admin', 'canAccessFuncionarios', 'canAccessPrestServ',
    'canAccessPlanejamento', 'canAccessLogistica', 'canAccessAdmin',
    'canAccessRH', 'canAccessTreinamento', 'canAccessMedicina',
    'gerenciar_usuarios', 'gerenciar_equipes'
  ],
  'RH': ['canAccessFuncionarios', 'canAccessRH'],
  'Treinamento': ['canAccessFuncionarios', 'canAccessTreinamento'],
  'Medicina': ['canAccessFuncionarios', 'canAccessMedicina'],
  'Logística': ['canAccessFuncionarios', 'canAccessLogistica', 'canAccessPrestServ'],
  'Planejamento': ['canAccessFuncionarios', 'canAccessPlanejamento'],
  'Prestserv': ['canAccessFuncionarios', 'canAccessPrestServ']
}
```

### **🛡️ Proteção de Rotas Centralizada:**

```typescript
ROUTE_PROTECTION = {
  ADMIN: {
    requiredEquipe: ['Administração'],
    requiredPermissions: ['admin', 'gerenciar_usuarios']
  },
  PRESTSERV: {
    requiredEquipe: ['LOGISTICA', 'PRESTSERV', 'Administração'],
    requiredPermissions: ['admin', 'canAccessPrestServ']
  },
  LOGISTICA: {
    requiredEquipe: ['LOGISTICA', 'Administração'],
    requiredPermissions: ['admin', 'canAccessLogistica']
  },
  PLANEJAMENTO: {
    requiredEquipe: ['PLANEJAMENTO', 'Administração'],
    requiredPermissions: ['admin', 'canAccessPlanejamento']
  }
}
```

### **📝 Como Usar:**

#### **1. Proteção de Rotas:**
```tsx
import { ROUTE_PROTECTION } from '@/lib/permissions';

<ProtectedRoute 
  requiredEquipe={ROUTE_PROTECTION.PRESTSERV.requiredEquipe}
  requiredPermissions={ROUTE_PROTECTION.PRESTSERV.requiredPermissions}
>
  <MinhaPagina />
</ProtectedRoute>
```

#### **2. Verificação de Permissões:**
```tsx
import { PERMISSIONS, hasFullAccess, hasModuleAccess } from '@/lib/permissions';

// Verificar se é admin
const isAdmin = hasFullAccess(usuario.permissoes);

// Verificar acesso a módulo
const canAccessPrestServ = hasModuleAccess(usuario.permissoes, PERMISSIONS.ACCESS_PREST_SERV);
```

#### **3. Obter Permissões por Equipe:**
```tsx
import { getPermissionsByTeam } from '@/lib/permissions';

const permissoes = getPermissionsByTeam('Administração');
```

### **✅ Benefícios da Centralização:**

1. **Consistência:** Todas as permissões definidas em um local
2. **Manutenibilidade:** Mudanças em um lugar refletem em todo o sistema
3. **Tipagem:** TypeScript garante uso correto das permissões
4. **Padronização:** Nomes e estruturas consistentes
5. **Escalabilidade:** Fácil adicionar novas permissões e equipes

### **🔄 Migração Completa:**

- ✅ **API de Verificação** - Usa sistema centralizado
- ✅ **Sidebar** - Usa permissões centralizadas
- ✅ **Páginas de Administração** - Usa ROUTE_PROTECTION
- ✅ **Páginas do Prestserv** - Usa ROUTE_PROTECTION
- ✅ **Páginas de Logística** - Usa ROUTE_PROTECTION
- ✅ **Páginas de Planejamento** - Usa ROUTE_PROTECTION

### **🎯 Padronização:**

- **`admin`** = Acesso total (substitui `canAccessAdmin`)
- **`canAccessX`** = Acesso específico ao módulo X
- **`gerenciar_X`** = Permissão de gerenciamento específica

### **📋 Próximos Passos:**

1. **Remover** `canAccessAdmin` de todos os lugares
2. **Usar** apenas `admin` para acesso total
3. **Atualizar** documentação de equipes
4. **Testar** todas as rotas com diferentes usuários

---

## 🚀 **Como Testar:**

1. **Login como Administrador** (`ADMIN001` / `admin123`)
2. **Verificar** acesso a todas as páginas
3. **Login como usuário específico** (RH, Logística, etc.)
4. **Confirmar** acesso apenas às páginas da equipe
5. **Testar** redirecionamento para `/unauthorized`

O sistema agora está **completamente centralizado** e **padronizado**! 🎉# CrewFlow - Deploy Automático Ativo!