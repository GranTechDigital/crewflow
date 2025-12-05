# Use a imagem oficial do Node.js (no-op para acionar workflow de produção)
FROM node:18-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
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
CMD ["npm", "start"]