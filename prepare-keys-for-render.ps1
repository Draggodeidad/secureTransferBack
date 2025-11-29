# 🔐 Script para Preparar Keys para Render
# Uso: .\prepare-keys-for-render.ps1

Write-Host "🔐 Preparando claves para deploy en Render`n" -ForegroundColor Cyan

# Verificar si existe la carpeta keys/
if (!(Test-Path "keys")) {
    Write-Host "❌ No existe la carpeta 'keys/'" -ForegroundColor Red
    Write-Host "💡 Genera primero las claves con: npm run generate:keys`n" -ForegroundColor Yellow
    exit 1
}

# Buscar archivos de claves
$publicKeyFiles = Get-ChildItem "keys\public_*.pem" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
$privateKeyFiles = Get-ChildItem "keys\private_*.pem" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending

if ($publicKeyFiles.Count -eq 0 -or $privateKeyFiles.Count -eq 0) {
    Write-Host "❌ No se encontraron archivos .pem en la carpeta keys/" -ForegroundColor Red
    Write-Host "💡 Ejecuta primero: npm run generate:keys`n" -ForegroundColor Yellow
    exit 1
}

# Mostrar archivos disponibles
Write-Host "📄 Archivos de claves encontrados:`n" -ForegroundColor Green

Write-Host "Claves PÚBLICAS:" -ForegroundColor Yellow
for ($i = 0; $i -lt [Math]::Min(5, $publicKeyFiles.Count); $i++) {
    Write-Host "  $($i + 1). $($publicKeyFiles[$i].Name) - $(Get-Date $publicKeyFiles[$i].LastWriteTime -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor White
}

Write-Host "`nClaves PRIVADAS:" -ForegroundColor Yellow
for ($i = 0; $i -lt [Math]::Min(5, $privateKeyFiles.Count); $i++) {
    Write-Host "  $($i + 1). $($privateKeyFiles[$i].Name) - $(Get-Date $privateKeyFiles[$i].LastWriteTime -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor White
}

# Seleccionar claves
Write-Host ""
$publicIdx = Read-Host "Selecciona el número de la clave PÚBLICA (1-$($publicKeyFiles.Count))"
$privateIdx = Read-Host "Selecciona el número de la clave PRIVADA (1-$($privateKeyFiles.Count))"

# Validar selección
if ([int]$publicIdx -lt 1 -or [int]$publicIdx -gt $publicKeyFiles.Count -or 
    [int]$privateIdx -lt 1 -or [int]$privateIdx -gt $privateKeyFiles.Count) {
    Write-Host "`n❌ Selección inválida" -ForegroundColor Red
    exit 1
}

# Leer archivos
$publicKeyFile = $publicKeyFiles[[int]$publicIdx - 1]
$privateKeyFile = $privateKeyFiles[[int]$privateIdx - 1]

Write-Host "`n📖 Leyendo claves..." -ForegroundColor Cyan
$publicKey = Get-Content $publicKeyFile.FullName -Raw
$privateKey = Get-Content $privateKeyFile.FullName -Raw

# Convertir saltos de línea para Render (usar \n)
$publicKeyEnv = $publicKey -replace "`r`n", "\n" -replace "`n$", ""
$privateKeyEnv = $privateKey -replace "`r`n", "\n" -replace "`n$", ""

# Crear archivo temporal con las variables
$outputFile = "render-env-vars.txt"
$content = @"
# ================================================
# VARIABLES DE ENTORNO PARA RENDER
# ================================================
# Generado: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
# Clave pública: $($publicKeyFile.Name)
# Clave privada: $($privateKeyFile.Name)
# ================================================

# Copia estas variables en el dashboard de Render:
# Settings → Environment → Add Environment Variable

# ================================================
# 1. SUPABASE (obtén estos valores de tu dashboard de Supabase)
# ================================================

SUPABASE_URL=https://XXXXXX.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.XXXXXX
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.XXXXXX
SUPABASE_BUCKET_NAME=fileStorage

# ================================================
# 2. SERVIDOR
# ================================================

NODE_ENV=production
PORT=10000

# ================================================
# 3. CLAVES RSA DEL SERVIDOR
# ================================================

SERVER_PUBLIC_KEY=$publicKeyEnv

SERVER_PRIVATE_KEY=$privateKeyEnv

# ================================================
# NOTAS IMPORTANTES:
# ================================================
# 
# ⚠️  Las claves deben tener \n (no saltos de línea reales)
# ⚠️  NO agregues comillas extras en Render
# ⚠️  Copia exactamente como aparece arriba
# ⚠️  NUNCA compartas la clave privada
# 
# En Render:
# 1. Ve a tu servicio → Settings → Environment
# 2. Click "Add Environment Variable"
# 3. Copia nombre y valor de cada variable
# 4. Click "Save Changes"
# 
# ================================================
"@

# Guardar en archivo
$content | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "`n✅ Archivo generado exitosamente: $outputFile" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos pasos:" -ForegroundColor Cyan
Write-Host "  1. Abre el archivo: $outputFile" -ForegroundColor White
Write-Host "  2. Ve a Render Dashboard → Tu servicio → Settings → Environment" -ForegroundColor White
Write-Host "  3. Copia cada variable y su valor" -ForegroundColor White
Write-Host "  4. Reemplaza los valores de SUPABASE con los tuyos" -ForegroundColor White
Write-Host "  5. Click 'Save Changes' en Render" -ForegroundColor White
Write-Host ""

# Preguntar si quiere ver el archivo
$openFile = Read-Host "¿Quieres abrir el archivo ahora? (s/n)"
if ($openFile -eq "s" -or $openFile -eq "S" -or $openFile -eq "si" -or $openFile -eq "Si") {
    Start-Process notepad $outputFile
}

Write-Host "`n🎉 ¡Listo! Sigue la guía en docs/DEPLOY_RENDER_GUIDE.md para el resto del deploy`n" -ForegroundColor Green

# Mostrar también un resumen en consola
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "RESUMEN DE CLAVES (Solo primeros y últimos caracteres):" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""
Write-Host "SERVER_PUBLIC_KEY:" -ForegroundColor Cyan
Write-Host "  Inicia con: $($publicKeyEnv.Substring(0, [Math]::Min(50, $publicKeyEnv.Length)))..." -ForegroundColor Gray
Write-Host "  Termina con: ...$($publicKeyEnv.Substring([Math]::Max(0, $publicKeyEnv.Length - 50)))" -ForegroundColor Gray
Write-Host ""
Write-Host "SERVER_PRIVATE_KEY:" -ForegroundColor Cyan
Write-Host "  Inicia con: $($privateKeyEnv.Substring(0, [Math]::Min(50, $privateKeyEnv.Length)))..." -ForegroundColor Gray
Write-Host "  Termina con: ...$($privateKeyEnv.Substring([Math]::Max(0, $privateKeyEnv.Length - 50)))" -ForegroundColor Gray
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""
Write-Host "⚠️  IMPORTANTE: Guarda este archivo en un lugar seguro" -ForegroundColor Red
Write-Host "⚠️  NO lo subas a Git (ya está en .gitignore)" -ForegroundColor Red
Write-Host ""

