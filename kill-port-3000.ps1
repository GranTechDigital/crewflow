# Script para encerrar processos na porta 3000 e iniciar o servidor
Write-Host "Verificando processos na porta 3000..." -ForegroundColor Yellow

# Buscar processos usando a porta 3000
$processes = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }

if ($processes) {
    Write-Host "Encontrados processos na porta 3000. Encerrando..." -ForegroundColor Red
    foreach ($process in $processes) {
        $processId = $process.OwningProcess
        Write-Host "Encerrando processo PID: $processId" -ForegroundColor Red
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Processos encerrados com sucesso!" -ForegroundColor Green
    Start-Sleep -Seconds 2
} else {
    Write-Host "Nenhum processo encontrado na porta 3000." -ForegroundColor Green
}

# Iniciar o servidor de desenvolvimento
Write-Host "Iniciando servidor de desenvolvimento..." -ForegroundColor Cyan
npm run dev