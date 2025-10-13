# Use a imagem oficial do Node.js
FROM node:18-alpine

# Instalar dependências necessárias
RUN apk add --no-cache libc6-compat

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependências
RUN npm ci

# Copiar código fonte
COPY . .

# Gerar cliente Prisma
RUN npx prisma generate

# Build da aplicação
RUN npm run build

# Expor porta 3001 para produção web
EXPOSE 3001

# Definir variáveis de ambiente para servidor web
ENV PORT=3001
ENV NODE_ENV=production

# Comando para iniciar o servidor web Next.js
CMD ["npm", "start"]