# Gran System - Sistema de Gestão Integrada

Sistema de gestão desenvolvido em Next.js para controle de funcionários, remanejamentos, tarefas e administração.

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
git clone <url-do-repositorio>
cd projetogran
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
