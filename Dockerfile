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

# Expor porta
EXPOSE 3000

# Definir variável de ambiente
ENV PORT=3000
ENV NODE_ENV=production

# Comando para iniciar a aplicação
CMD ["npm", "start"]