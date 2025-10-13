@echo off
echo Iniciando PostgreSQL com Docker...

REM Verificar se Docker Desktop está rodando
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker Desktop não está rodando. Iniciando...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo Aguardando Docker Desktop inicializar...
    timeout /t 30 /nobreak >nul
)

REM Aguardar Docker estar pronto
:wait_docker
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo Aguardando Docker ficar disponível...
    timeout /t 5 /nobreak >nul
    goto wait_docker
)

echo Docker está pronto!

REM Iniciar PostgreSQL
echo Iniciando container PostgreSQL...
docker-compose -f docker-compose.staging-postgres.yml up -d postgres-staging

REM Aguardar PostgreSQL estar pronto
echo Aguardando PostgreSQL ficar disponível...
timeout /t 10 /nobreak >nul

REM Verificar se PostgreSQL está rodando
docker ps | findstr postgres-staging
if %errorlevel% equ 0 (
    echo PostgreSQL iniciado com sucesso!
    echo Executando migrações...
    npx prisma migrate dev --name init
    echo Executando seed...
    npm run seed
    echo Pronto! Agora você pode executar: npm run dev
) else (
    echo Erro ao iniciar PostgreSQL
)

pause