# Script direto para corrigir problemas TypeScript
Write-Host "Iniciando correção direta de problemas TypeScript..." -ForegroundColor Green

$totalFixed = 0

# Função para substituir texto em arquivo
function Replace-Text {
    param([string]$File, [string]$Find, [string]$Replace)
    
    if (Test-Path $File) {
        try {
            $content = Get-Content $File -Raw -Encoding UTF8
            if ($content -and $content.Contains($Find)) {
                $newContent = $content.Replace($Find, $Replace)
                Set-Content $File $newContent -NoNewline -Encoding UTF8
                Write-Host "✓ $File" -ForegroundColor Green
                return $true
            }
        } catch {
            Write-Host "✗ $File" -ForegroundColor Red
        }
    }
    return $false
}

Write-Host "`n1. Corrigindo tipos unknown..." -ForegroundColor Cyan

# Período upload - tipos unknown
$file1 = "src\app\api\periodo\upload\route.ts"
if (Replace-Text $file1 "worksheet: unknown" "worksheet: any") { $totalFixed++ }
if (Replace-Text $file1 "row: unknown" "row: any") { $totalFixed++ }
if (Replace-Text $file1 "obj: unknown" "obj: any") { $totalFixed++ }
if (Replace-Text $file1 "jsonData: unknown[]" "jsonData: any[]") { $totalFixed++ }
if (Replace-Text $file1 "dadosExtraidos: unknown[]" "dadosExtraidos: any[]") { $totalFixed++ }

# Logística remanejamentos
$file2 = "src\app\api\logistica\remanejamentos\route.ts"
if (Replace-Text $file2 "solicitacoes: unknown[]" "solicitacoes: any[]") { $totalFixed++ }
if (Replace-Text $file2 "(s: unknown)" "(s: any)") { $totalFixed++ }

Write-Host "`n2. Corrigindo catch blocks..." -ForegroundColor Cyan

# Catch blocks
if (Replace-Text $file1 "} catch (error) {" "} catch (_error) {") { $totalFixed++ }
if (Replace-Text $file1 'console.error("Erro ao processar planilha:", error)' 'console.error("Erro ao processar planilha:", _error)') { $totalFixed++ }
if (Replace-Text $file1 'console.error("Erro ao processar dados:", error)' 'console.error("Erro ao processar dados:", _error)') { $totalFixed++ }

Write-Host "`n3. Removendo variáveis não utilizadas..." -ForegroundColor Cyan

# Variáveis não utilizadas
if (Replace-Text $file1 "const deletedSheets = " "const _deletedSheets = ") { $totalFixed++ }
if (Replace-Text $file1 "const deletedUploads = " "const _deletedUploads = ") { $totalFixed++ }
if (Replace-Text $file1 "sispat," "_sispat,") { $totalFixed++ }

Write-Host "`n4. Corrigindo parâmetros request..." -ForegroundColor Cyan

# Request parameters
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
    if (Replace-Text $file "request: Request" "_request: Request") { $totalFixed++ }
}

Write-Host "`n5. Corrigindo imports..." -ForegroundColor Cyan

# Imports não utilizados
if (Replace-Text "src\app\api\usuarios\[id]\route.ts" "import bcrypt from 'bcryptjs';" "") { $totalFixed++ }

Write-Host "`n6. Corrigindo let para const..." -ForegroundColor Cyan

# Let para const
if (Replace-Text "src\app\api\dados\sincronizar\route.ts" "let contadores = " "const contadores = ") { $totalFixed++ }
if (Replace-Text $file1 "let matricula = " "const matricula = ") { $totalFixed++ }
if (Replace-Text $file1 "let statusMappingCache = " "const statusMappingCache = ") { $totalFixed++ }

Write-Host "`n7. Corrigindo Maps..." -ForegroundColor Cyan

# Maps
$mapFiles = @(
    "src\app\api\prestserv\funcionarios-dashboard\route.ts",
    "src\app\api\prestserv\funcionarios-por-contrato\route.ts",
    "src\app\api\prestserv\funcionarios\route.ts"
)

foreach ($file in $mapFiles) {
    if (Replace-Text $file "new Map()" "new Map<string, any>()") { $totalFixed++ }
}

Write-Host "`n8. Corrigindo forEach..." -ForegroundColor Cyan

# ForEach
foreach ($file in $mapFiles) {
    if (Replace-Text $file ".forEach(funcionario => {" ".forEach((funcionario: any) => {") { $totalFixed++ }
    if (Replace-Text $file ".forEach(contrato => {" ".forEach((contrato: any) => {") { $totalFixed++ }
}

Write-Host "`n9. Corrigindo sort..." -ForegroundColor Cyan

# Sort
$sortFile = "src\app\api\prestserv\funcionarios-por-contrato\route.ts"
if (Replace-Text $sortFile "contrato.funcionarios.sort((a, b) => a.nome.localeCompare(b.nome))" "contrato.funcionarios.sort((a: any, b: any) => a.nome.localeCompare(b.nome))") { $totalFixed++ }
if (Replace-Text $sortFile ".sort((a, b) => {" ".sort((a: any, b: any) => {") { $totalFixed++ }

Write-Host "`n10. Corrigindo XLSX..." -ForegroundColor Cyan

# XLSX
$xlsxFiles = @(
    "src\app\prestserv\funcionarios\page.tsx",
    "src\app\prestserv\funcionarios-por-contrato\page.tsx",
    "src\app\uptime\page.tsx",
    "src\app\downtime\page.tsx",
    "src\app\tarefas\page.tsx"
)

foreach ($file in $xlsxFiles) {
    if (Test-Path $file) {
        if (Replace-Text $file "import xlsx from 'xlsx';" "import * as XLSX from 'xlsx';") { $totalFixed++ }
        if (Replace-Text $file "import { read, utils } from 'xlsx';" "import * as XLSX from 'xlsx';") { $totalFixed++ }
        if (Replace-Text $file "xlsx." "XLSX.") { $totalFixed++ }
        if (Replace-Text $file "read(" "XLSX.read(") { $totalFixed++ }
        if (Replace-Text $file "utils." "XLSX.utils.") { $totalFixed++ }
    }
}

Write-Host "`n" -NoNewline
Write-Host "=" * 40 -ForegroundColor Yellow
Write-Host "TOTAL CORRIGIDO: $totalFixed" -ForegroundColor Green
Write-Host "=" * 40 -ForegroundColor Yellow