@echo off
echo === INICIANDO AMBIENTE DE DESENVOLVIMENTO LOCAL ===

REM Parando containers existentes
echo Parando containers existentes...
docker-compose -f docker-compose.dev.yml down

REM Iniciando os containers de desenvolvimento
echo Iniciando containers de desenvolvimento...
docker-compose -f docker-compose.dev.yml up -d

REM Aguardando o banco iniciar
echo Aguardando o banco de dados iniciar...
timeout /t 5 /nobreak

REM Executando migrações e criando usuário admin
echo Executando migrações e criando usuário admin...
docker exec crewflow-app-dev npx prisma migrate dev --name init
docker exec crewflow-app-dev node create-admin-user.js

echo === AMBIENTE DE DESENVOLVIMENTO PRONTO ===
echo Acesse: http://localhost:3000
echo Usuário: ADMIN001
echo Credenciais admin criadas pelo seed; ajuste via .env.dev
echo pgAdmin: http://localhost:5050
echo.
echo Para ver os logs: docker logs -f crewflow-app-dev
echo Para parar: npm run dev:docker:down