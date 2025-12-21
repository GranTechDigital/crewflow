# Use a imagem oficial do Node.js (no-op para acionar workflow de produção)
FROM node:18-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
# Garantir que devDependencies sejam instaladas no estágio de build
ENV NODE_ENV=production
ENV NPM_CONFIG_PRODUCTION=false
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=4096
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate
COPY . .
RUN npm run build
RUN rm -rf .next/cache || true

FROM node:18-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV PORT=3001
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/create-admin-user.js ./create-admin-user.js
RUN npm ci --omit=dev && npm i prisma --no-save
EXPOSE 3001
# Startup: se existir um arquivo de vínculos em /app/data, executar o script antes de iniciar a app
# Não bloqueia o start em caso de falha no script; cria /app/data se não existir
CMD ["sh", "-lc", "mkdir -p /app/data /app/relatorios; FILE=/app/data/vinculos.xlsx; if [ ! -f \"$FILE\" ]; then CAND=$(ls -1t /app/data/*.xlsx 2>/dev/null | head -n1); if [ -n \"$CAND\" ]; then FILE=\"$CAND\"; fi; fi; if [ -f \"$FILE\" ]; then echo \"🔗 Executando vinculos com: $FILE\"; node scripts/vincular-funcionarios-contratos.js \"$FILE\" || true; if [ -f /app/relatorio-vinculos-funcionarios.xlsx ]; then cp -f /app/relatorio-vinculos-funcionarios.xlsx /app/relatorios/relatorio-vinculos-funcionarios.xlsx || true; fi; fi; npm start"]