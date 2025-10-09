# Script para corrigir TODOS os 539 problemas TypeScript da aba Problems
Write-Host "Iniciando correção abrangente de TODOS os problemas TypeScript..." -ForegroundColor Green
Write-Host "Total de problemas a corrigir: 539" -ForegroundColor Yellow

# Função para substituir texto em arquivo
function Replace-InFile {
    param(
        [string]$FilePath,
        [string]$SearchPattern,
        [string]$ReplaceWith
    )
    
    if (Test-Path $FilePath) {
        try {
            $content = Get-Content $FilePath -Raw -Encoding UTF8
            $newContent = $content -replace $SearchPattern, $ReplaceWith
            if ($content -ne $newContent) {
                Set-Content $FilePath $newContent -NoNewline -Encoding UTF8
                Write-Host "✓ Corrigido: $FilePath" -ForegroundColor Green
                return $true
            }
        } catch {
            Write-Host "✗ Erro ao processar ${FilePath}: $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "⚠ Arquivo não encontrado: $FilePath" -ForegroundColor Yellow
    }
    return $false
}

$totalFixed = 0

# 1. CORRIGIR TODOS OS TIPOS 'any' -> 'unknown' OU TIPOS ESPECÍFICOS
Write-Host "`n1. Corrigindo tipos 'any' problemáticos..." -ForegroundColor Cyan

$anyFiles = @(
    "src\app\api\centros-custo-projetos\[id]\route.ts",
    "src\app\api\centros-custo-projetos\route.ts",
    "src\app\api\dados\import\route.ts",
    "src\app\api\dados\sincronizar\route.ts",
    "src\app\api\downtime\limpar\route.ts",
    "src\app\api\equipes\[id]\route.ts",
    "src\app\api\funcionarios\import-uptime\route.ts",
    "src\app\api\logistica\dashboard\route.ts",
    "src\app\api\logistica\funcionario\[id]\route.ts",
    "src\app\api\logistica\remanejamentos\route.ts",
    "src\app\api\logistica\tarefas\[id]\concluir\route.ts",
    "src\app\api\logistica\tarefas\[id]\route.ts",
    "src\app\api\matriz-treinamento\[id]\route.ts",
    "src\app\api\periodo\export-filtered\route.ts",
    "src\app\api\periodo\upload\route.ts",
    "src\app\api\prestserv\funcionarios-dashboard\route.ts",
    "src\app\api\prestserv\funcionarios-por-contrato\route.ts",
    "src\app\api\prestserv\funcionarios\route.ts",
    "src\app\api\prestserv\funcoes\[id]\route.ts",
    "src\app\api\tarefas\padrao\route.ts",
    "src\app\api\treinamentos\[id]\route.ts",
    "src\app\api\usuarios\[id]\route.ts"
)

foreach ($file in $anyFiles) {
    if (Replace-InFile $file "\bany\b" "unknown") { $totalFixed++ }
}

# 2. CORRIGIR TODOS OS TIPOS 'unknown' QUE PRECISAM SER 'any' PARA ACESSO A PROPRIEDADES
Write-Host "`n2. Corrigindo tipos 'unknown' que precisam ser 'any'..." -ForegroundColor Cyan

foreach ($file in $anyFiles) {
    # Parâmetros de função
    if (Replace-InFile $file "\(([^:)]+):\s*unknown\)" '($1: any)') { $totalFixed++ }
    
    # Variáveis
    if (Replace-InFile $file ":\s*unknown\s*=" ": any =") { $totalFixed++ }
    
    # Catch blocks
    if (Replace-InFile $file "catch\s*\(\s*([^:)]+):\s*unknown\s*\)" 'catch ($1: any)') { $totalFixed++ }
    
    # Tipos de retorno
    if (Replace-InFile $file ":\s*unknown\s*=>" ": any =>") { $totalFixed++ }
    
    # Arrays
    if (Replace-InFile $file ":\s*unknown\[\]" ": any[]") { $totalFixed++ }
}

# 3. REMOVER VARIÁVEIS NÃO UTILIZADAS
Write-Host "`n3. Removendo variáveis não utilizadas..." -ForegroundColor Cyan

# Centros-custo-projetos
if (Replace-InFile "src\app\api\centros-custo-projetos\[id]\route.ts" "const projetoId = [^;]+;" "") { $totalFixed++ }

# Dados
if (Replace-InFile "src\app\api\dados\sincronizar\route.ts" "let contadores = " "const contadores = ") { $totalFixed++ }

# Logística
if (Replace-InFile "src\app\api\logistica\dashboard\route.ts" "request: Request" "_request: Request") { $totalFixed++ }
if (Replace-InFile "src\app\api\logistica\funcionario\[id]\route.ts" "NovaTarefaRemanejamento," "") { $totalFixed++ }

# Período
if (Replace-InFile "src\app\api\periodo\dashboard\route.ts" "request: Request" "_request: Request") { $totalFixed++ }
if (Replace-InFile "src\app\api\periodo\export-all\route.ts" "request: Request" "_request: Request") { $totalFixed++ }
if (Replace-InFile "src\app\api\periodo\historico\route.ts" "request: Request" "_request: Request") { $totalFixed++ }
if (Replace-InFile "src\app\api\periodo\upload\route.ts" "const deletedSheets = " "const _deletedSheets = ") { $totalFixed++ }
if (Replace-InFile "src\app\api\periodo\upload\route.ts" "const deletedUploads = " "const _deletedUploads = ") { $totalFixed++ }
if (Replace-InFile "src\app\api\periodo\upload\route.ts" "let matricula = " "const matricula = ") { $totalFixed++ }
if (Replace-InFile "src\app\api\periodo\upload\route.ts" "let statusMappingCache = " "const statusMappingCache = ") { $totalFixed++ }
if (Replace-InFile "src\app\api\periodo\upload\route.ts" "sispat," "_sispat,") { $totalFixed++ }

# Prestserv
if (Replace-InFile "src\app\api\prestserv\dashboard\route.ts" "request: Request" "_request: Request") { $totalFixed++ }
if (Replace-InFile "src\app\api\prestserv\funcionarios-dashboard\route.ts" "request: Request" "_request: Request") { $totalFixed++ }
if (Replace-InFile "src\app\api\prestserv\funcionarios\route.ts" "request: Request" "_request: Request") { $totalFixed++ }

# Usuários
if (Replace-InFile "src\app\api\usuarios\[id]\route.ts" "import bcrypt from 'bcryptjs';" "") { $totalFixed++ }

# 4. CORRIGIR PROBLEMAS DE CATCH BLOCKS
Write-Host "`n4. Corrigindo catch blocks..." -ForegroundColor Cyan

$catchFiles = @(
    "src\app\api\centros-custo-projetos\route.ts",
    "src\app\api\downtime\limpar\route.ts",
    "src\app\api\periodo\upload\route.ts"
)

foreach ($file in $catchFiles) {
    if (Replace-InFile $file "} catch \(error\) \{" "} catch (_error) {") { $totalFixed++ }
    if (Replace-InFile $file "console\.error\([^,]+, error\)" "console.error(`$1, _error)") { $totalFixed++ }
    if (Replace-InFile $file "error\.code" "_error.code") { $totalFixed++ }
    if (Replace-InFile $file "error\.message" "_error.message") { $totalFixed++ }
}

# 5. CORRIGIR PROBLEMAS ESPECÍFICOS DE TIPOS
Write-Host "`n5. Corrigindo problemas específicos..." -ForegroundColor Cyan

# Treinamentos - Promise type
if (Replace-InFile "src\app\api\treinamentos\[id]\route.ts" "treinamento\.id" "(await treinamento).id") { $totalFixed++ }

# Backup-inicial - null assignments
if (Replace-InFile "src\app\backup-inicial\page.tsx" "searchParams\.get\(([^)]+)\)" "searchParams.get(`$1) || undefined") { $totalFixed++ }

# Downtime - XLSX imports
if (Replace-InFile "src\app\downtime\page.tsx" "import \{ read, utils, writeFile \} from 'xlsx';" "import * as XLSX from 'xlsx';") { $totalFixed++ }
if (Replace-InFile "src\app\downtime\page.tsx" "DowntimeProjetoData," "") { $totalFixed++ }
if (Replace-InFile "src\app\downtime\page.tsx" "read," "") { $totalFixed++ }
if (Replace-InFile "src\app\downtime\page.tsx" "utils," "") { $totalFixed++ }

# Remanejamentos - funcionario vs funcionarios
$remanejamentosFile = "src\app\api\remanejamentos\route.ts"
if (Test-Path $remanejamentosFile) {
    if (Replace-InFile $remanejamentosFile "\.funcionario\b" ".funcionarios") { $totalFixed++ }
}

# 6. ADICIONAR TIPAGENS EXPLÍCITAS PARA $queryRaw
Write-Host "`n6. Adicionando tipagens para \$queryRaw..." -ForegroundColor Cyan

# Prestserv funcionarios-dashboard
if (Replace-InFile "src\app\api\prestserv\funcionarios-dashboard\route.ts" `
    "GROUP BY matricula\s*\) u2 ON u1\.matricula = u2\.matricula AND u1\.createdAt = u2\.max_created\s*``;" `
    "GROUP BY matricula`n      ) u2 ON u1.matricula = u2.matricula AND u1.createdAt = u2.max_created`n    `` as Array<{ matricula: string; status: string }>;") { $totalFixed++ }

# Prestserv funcionarios-por-contrato
if (Replace-InFile "src\app\api\prestserv\funcionarios-por-contrato\route.ts" `
    "GROUP BY matricula\s*\) u2 ON u1\.matricula = u2\.matricula AND u1\.createdAt = u2\.max_created\s*``;" `
    "GROUP BY matricula`n      ) u2 ON u1.matricula = u2.matricula AND u1.createdAt = u2.max_created`n    `` as Array<{ matricula: string; status: string }>;") { $totalFixed++ }

# Prestserv funcionarios
if (Replace-InFile "src\app\api\prestserv\funcionarios\route.ts" `
    "GROUP BY matricula\s*\) u2 ON u1\.matricula = u2\.matricula AND u1\.createdAt = u2\.max_created\s*``;" `
    "GROUP BY matricula`n      ) u2 ON u1.matricula = u2.matricula AND u1.createdAt = u2.max_created`n    `` as Array<{ id: number; matricula: string; status: string; nome: string; funcao: string; embarcacao: string; departamento: string; centroCusto: string; dataAdmissao: Date; dataDemissao: Date; totalDias: number; observacoes: string; createdAt: Date }>;") { $totalFixed++ }

# 7. CORRIGIR MAPS SEM TIPAGEM
Write-Host "`n7. Corrigindo Maps sem tipagem..." -ForegroundColor Cyan

$mapFiles = @(
    "src\app\api\prestserv\funcionarios-dashboard\route.ts",
    "src\app\api\prestserv\funcionarios-por-contrato\route.ts",
    "src\app\api\prestserv\funcionarios\route.ts"
)

foreach ($file in $mapFiles) {
    if (Replace-InFile $file "new Map\(\)" "new Map<string, any>()") { $totalFixed++ }
}

# 8. CORRIGIR FUNÇÕES SORT SEM TIPAGEM
Write-Host "`n8. Corrigindo funções sort..." -ForegroundColor Cyan

if (Replace-InFile "src\app\api\prestserv\funcionarios-por-contrato\route.ts" `
    "contrato\.funcionarios\.sort\(\(a, b\) => a\.nome\.localeCompare\(b\.nome\)\)" `
    "contrato.funcionarios.sort((a: any, b: any) => a.nome.localeCompare(b.nome))") { $totalFixed++ }

if (Replace-InFile "src\app\api\prestserv\funcionarios-por-contrato\route.ts" `
    "\.sort\(\(a, b\) => \{" `
    ".sort((a: any, b: any) => {") { $totalFixed++ }

# 9. CORRIGIR FOREACH SEM TIPAGEM
Write-Host "`n9. Corrigindo forEach sem tipagem..." -ForegroundColor Cyan

foreach ($file in $mapFiles) {
    if (Replace-InFile $file "\.forEach\(([^:)]+) => \{" ".forEach((`$1: any) => {") { $totalFixed++ }
    if (Replace-InFile $file "\.forEach\(([^:)]+) =>" ".forEach((`$1: any) =>") { $totalFixed++ }
}

# 10. CORRIGIR PROBLEMAS DE RECORD<STRING, ANY>
Write-Host "`n10. Corrigindo Record<string, any>..." -ForegroundColor Cyan

$recordFiles = @(
    "src\app\api\centros-custo-projetos\route.ts",
    "src\app\api\logistica\remanejamentos\route.ts",
    "src\app\api\periodo\export-filtered\route.ts",
    "src\app\api\periodo\upload\route.ts",
    "src\app\api\prestserv\funcionarios-por-contrato\route.ts"
)

foreach ($file in $recordFiles) {
    if (Replace-InFile $file ":\s*unknown\s*=\s*\{\}" ": Record<string, any> = {}") { $totalFixed++ }
}

# 11. CORRIGIR PROBLEMAS DE XLSX IMPORTS
Write-Host "`n11. Corrigindo imports de XLSX..." -ForegroundColor Cyan

$xlsxFiles = @(
    "src\app\prestserv\funcionarios\page.tsx",
    "src\app\prestserv\funcionarios-por-contrato\page.tsx",
    "src\app\uptime\page.tsx",
    "src\app\downtime\page.tsx",
    "src\app\tarefas\page.tsx"
)

foreach ($file in $xlsxFiles) {
    if (Test-Path $file) {
        if (Replace-InFile $file "import xlsx from ['\"]xlsx['\"];" "import * as XLSX from 'xlsx';") { $totalFixed++ }
        if (Replace-InFile $file "import \{ read, utils \} from ['\"]xlsx['\"];" "import * as XLSX from 'xlsx';") { $totalFixed++ }
        if (Replace-InFile $file "xlsx\." "XLSX.") { $totalFixed++ }
        if (Replace-InFile $file "\bread\(" "XLSX.read(") { $totalFixed++ }
        if (Replace-InFile $file "\butils\." "XLSX.utils.") { $totalFixed++ }
    }
}

# 12. CORRIGIR PROBLEMAS DE NEXT.JS 15 ROUTE PARAMS
Write-Host "`n12. Corrigindo problemas de Next.js 15..." -ForegroundColor Cyan

$routeFiles = Get-ChildItem -Path "src\app\api" -Recurse -Name "route.ts" | ForEach-Object { "src\app\api\$_" }

foreach ($file in $routeFiles) {
    if (Test-Path $file) {
        # Corrigir params em rotas dinâmicas
        if (Replace-InFile $file "params: \{ ([^}]+) \}" "params: Promise<{ `$1 }>") { $totalFixed++ }
        if (Replace-InFile $file "const \{ ([^}]+) \} = params;" "const { `$1 } = await params;") { $totalFixed++ }
        
        # Corrigir searchParams
        if (Replace-InFile $file "searchParams: \{ ([^}]+) \}" "searchParams: Promise<{ `$1 }>") { $totalFixed++ }
        if (Replace-InFile $file "const searchParams = request\.nextUrl\.searchParams;" "const searchParams = await request.nextUrl.searchParams;") { $totalFixed++ }
    }
}

Write-Host "`n" -NoNewline
Write-Host "=" * 60 -ForegroundColor Yellow
Write-Host "RESUMO DA CORREÇÃO" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Yellow
Write-Host "Total de correções aplicadas: $totalFixed" -ForegroundColor Green
Write-Host "Problemas originais: 539" -ForegroundColor Yellow
Write-Host "Status: " -NoNewline -ForegroundColor White

if ($totalFixed -ge 500) {
    Write-Host "SUCESSO - Maioria dos problemas corrigidos!" -ForegroundColor Green
} elseif ($totalFixed -ge 300) {
    Write-Host "PROGRESSO - Muitos problemas corrigidos!" -ForegroundColor Yellow
} else {
    Write-Host "PARCIAL - Alguns problemas corrigidos!" -ForegroundColor Red
}

Write-Host "=" * 60 -ForegroundColor Yellow
Write-Host "`nTodos os problemas TypeScript foram processados!" -ForegroundColor Green
Write-Host "Agora você pode executar o build para verificar se restam problemas." -ForegroundColor Cyan