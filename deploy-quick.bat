@echo off
echo 🚀 Iniciando deploy rápido do CrewFlow...

REM 1. Build da imagem
echo 🔧 Fazendo build da imagem...
docker build -t crewflow-app:latest .

if %errorlevel% neq 0 (
    echo ❌ Erro no build da imagem!
    pause
    exit /b 1
)

REM 2. Enviar para servidor
echo 📤 Enviando para servidor...
docker save crewflow-app:latest | ssh root@46.202.146.234 "docker load"

if %errorlevel% neq 0 (
    echo ❌ Erro ao enviar imagem para servidor!
    pause
    exit /b 1
)

REM 3. Atualizar container
echo 🔄 Atualizando container...
ssh root@46.202.146.234 "docker stop crewflow-app-production 2>/dev/null || true && docker rm crewflow-app-production 2>/dev/null || true && docker run -d --name crewflow-app-production -p 3001:3000 -e DATABASE_URL='postgresql://crewflow_user:crewflow_production_2024@postgres-prod:5432/crewflow_production?schema=public' -e JWT_SECRET='crewflow-jwt-secret-key-2024' -e NEXTAUTH_URL='http://46.202.146.234:3001' -e NODE_ENV='production' crewflow-app:latest"

if %errorlevel% neq 0 (
    echo ❌ Erro ao atualizar container!
    pause
    exit /b 1
)

echo.
echo ✅ Deploy do CrewFlow concluído com sucesso!
echo 🌐 Aplicação disponível em: http://46.202.146.234:3001
echo 🔐 Login: ADMIN001 / admin123
echo.
echo 🔍 Para verificar status:
echo    ssh root@46.202.146.234 "docker ps | grep crewflow"
echo.
echo 📋 Para ver logs:
echo    ssh root@46.202.146.234 "docker logs crewflow-app-production"
echo.
pause