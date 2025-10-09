# Script simplificado para corrigir problemas TypeScript
Write-Host "Iniciando correção de problemas TypeScript..." -ForegroundColor Green

$totalFixed = 0

# Função simples para substituir texto
function Fix-File {
    param([string]$FilePath, [string]$Old, [string]$New)
    
    if (Test-Path $FilePath) {
        try {
            $content = Get-Content $FilePath -Raw -Encoding UTF8
            if ($content -and $content.Contains($Old)) {
                $newContent = $content.Replace($Old, $New)
                Set-Content $FilePath $newContent -NoNewline -Encoding UTF8
                Write-Host "✓ Corrigido: $FilePath" -ForegroundColor Green
                return $true
            }
        } catch {
            Write-Host "✗ Erro: $FilePath" -ForegroundColor Red
        }
    }
    return $false
}

# 1. Corrigir tipos unknown para any onde necessário
Write-Host "`n1. Corrigindo tipos unknown..." -ForegroundColor Cyan

# Período upload
if (Fix-File "src\app\api\periodo\upload\route.ts" "worksheet: unknown" "worksheet: any") { $totalFixed++ }
if (Fix-File "src\app\api\periodo\upload\route.ts" "row: unknown" "row: any") { $totalFixed++ }
if (Fix-File "src\app\api\periodo\upload\route.ts" "obj: unknown" "obj: any") { $totalFixed++ }
if (Fix-File "src\app\api\periodo\upload\route.ts" "jsonData: unknown[]" "jsonData: any[]") { $totalFixed++ }
if (Fix-File "src\app\api\periodo\upload\route.ts" "dadosExtraidos: unknown[]" "dadosExtraidos: any[]") { $totalFixed++ }

# Logística remanejamentos
if (Fix-File "src\app\api\logistica\remanejamentos\route.ts" "solicitacoes: unknown[]" "solicitacoes: any[]") { $totalFixed++ }
if (Fix-File "src\app\api\logistica\remanejamentos\route.ts" "(s: unknown)" "(s: any)") { $totalFixed++ }

# 2. Corrigir catch blocks
Write-Host "`n2. Corrigindo catch blocks..." -ForegroundColor Cyan

if (Fix-File "src\app\api\periodo\upload\route.ts" "} catch (error) {" "} catch (_error) {") { $totalFixed++ }
if (Fix-File "src\app\api\periodo\upload\route.ts" "console.error(" + '"Erro ao processar planilha:", error)' "console.error(" + '"Erro ao processar planilha:", _error)') { $totalFixed++ }
if (Fix-File "src\app\api\periodo\upload\route.ts" "console.error(" + '"Erro ao processar dados:", error)' "console.error(" + '"Erro ao processar dados:", _error)') { $totalFixed++ }

# 3. Remover variáveis não utilizadas
Write-Host "`n3. Removendo variáveis não utilizadas..." -ForegroundColor Cyan

if (Fix-File "src\app\api\periodo\upload\route.ts" "const deletedSheets = " "const _deletedSheets = ") { $totalFixed++ }
if (Fix-File "src\app\api\periodo\upload\route.ts" "const deletedUploads = " "const _deletedUploads = ") { $totalFixed++ }
if (Fix-File "src\app\api\periodo\upload\route.ts" "sispat," "_sispat,") { $totalFixed++ }

# 4. Corrigir parâmetros request não utilizados
Write-Host "`n4. Corrigindo parâmetros request..." -ForegroundColor Cyan

$requestFiles = @(
    "src\app\api\logistica\dashboard\route.ts",
    "src\app\api\periodo\dashboard\route.ts",
    "src\app\api\periodo\export-all\route.ts",
    "src\app\api\periodo\historico\route.ts",
    "src\app\api\prestserv\dashboard\route.ts",
    "src\app\api\prestserv\funcionarios-dashboard\route.ts",
    "src\app\api\prestserv\funcionarios\route.ts"
)

foreach ($file in $requestFiles) {
    if (Fix-File $file "request: Request" "_request: Request") { $totalFixed++ }
}

# 5. Corrigir imports não utilizados
Write-Host "`n5. Corrigindo imports..." -ForegroundColor Cyan

if (Fix-File "src\app\api\usuarios\[id]\route.ts" "import bcrypt from 'bcryptjs';" "") { $totalFixed++ }
if (Fix-File "src\app\api\logistica\funcionario\[id]\route.ts" "NovaTarefaRemanejamento," "") { $totalFixed++ }

# 6. Corrigir variáveis let para const
Write-Host "`n6. Corrigindo let para const..." -ForegroundColor Cyan

if (Fix-File "src\app\api\dados\sincronizar\route.ts" "let contadores = " "const contadores = ") { $totalFixed++ }
if (Fix-File "src\app\api\periodo\upload\route.ts" "let matricula = " "const matricula = ") { $totalFixed++ }
if (Fix-File "src\app\api\periodo\upload\route.ts" "let statusMappingCache = " "const statusMappingCache = ") { $totalFixed++ }

# 7. Corrigir Maps sem tipagem
Write-Host "`n7. Corrigindo Maps..." -ForegroundColor Cyan

$mapFiles = @(
    "src\app\api\prestserv\funcionarios-dashboard\route.ts",
    "src\app\api\prestserv\funcionarios-por-contrato\route.ts",
    "src\app\api\prestserv\funcionarios\route.ts"
)

foreach ($file in $mapFiles) {
    if (Fix-File $file "new Map()" "new Map<string, any>()") { $totalFixed++ }
}

# 8. Corrigir forEach sem tipagem
Write-Host "`n8. Corrigindo forEach..." -ForegroundColor Cyan

foreach ($file in $mapFiles) {
    if (Fix-File $file ".forEach(funcionario => {" ".forEach((funcionario: any) => {") { $totalFixed++ }
    if (Fix-File $file ".forEach(contrato => {" ".forEach((contrato: any) => {") { $totalFixed++ }
}

# 9. Corrigir sort sem tipagem
Write-Host "`n9. Corrigindo sort..." -ForegroundColor Cyan

if (Fix-File "src\app\api\prestserv\funcionarios-por-contrato\route.ts" "contrato.funcionarios.sort((a, b) => a.nome.localeCompare(b.nome))" "contrato.funcionarios.sort((a: any, b: any) => a.nome.localeCompare(b.nome))") { $totalFixed++ }
if (Fix-File "src\app\api\prestserv\funcionarios-por-contrato\route.ts" ".sort((a, b) => {" ".sort((a: any, b: any) => {") { $totalFixed++ }

# 10. Corrigir XLSX imports
Write-Host "`n10. Corrigindo XLSX imports..." -ForegroundColor Cyan

$xlsxFiles = @(
    "src\app\prestserv\funcionarios\page.tsx",
    "src\app\prestserv\funcionarios-por-contrato\page.tsx",
    "src\app\uptime\page.tsx",
    "src\app\downtime\page.tsx",
    "src\app\tarefas\page.tsx"
)

foreach ($file in $xlsxFiles) {
    if (Test-Path $file) {
        if (Fix-File $file "import xlsx from 'xlsx';" "import * as XLSX from 'xlsx';") { $totalFixed++ }
        if (Fix-File $file "import { read, utils } from 'xlsx';" "import * as XLSX from 'xlsx';") { $totalFixed++ }
        if (Fix-File $file "xlsx." "XLSX.") { $totalFixed++ }
        if (Fix-File $file "read(" "XLSX.read(") { $totalFixed++ }
        if (Fix-File $file "utils." "XLSX.utils.") { $totalFixed++ }
    }
}

Write-Host "`n" -NoNewline
Write-Host "=" * 50 -ForegroundColor Yellow
Write-Host "RESUMO" -ForegroundColor Green
Write-Host "=" * 50 -ForegroundColor Yellow
Write-Host "Total de correções: $totalFixed" -ForegroundColor Green
Write-Host "=" * 50 -ForegroundColor Yellow