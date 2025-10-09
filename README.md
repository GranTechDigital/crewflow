# CrewFlow - Sistema de Gestão Integrada

Sistema de gestão desenvolvido em Next.js para controle de funcionários, remanejamentos, tarefas e administração.

🔄 **Deploy Automático Ativo** - Última atualização: $(date)

## 🚀 Tecnologias Utilizadas

- **Next.js 14** - Framework React
- **TypeScript** - Linguagem de programação
- **Prisma** - ORM para banco de dados
- **SQLite** - Banco de dados
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
DATABASE_URL="file:./dev.db"

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