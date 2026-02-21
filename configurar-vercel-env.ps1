# Script para adicionar variaveis do Supabase ao Vercel
# Execute no PowerShell: .\configurar-vercel-env.ps1

$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "Arquivo .env nao encontrado!" -ForegroundColor Red
    exit 1
}

$lines = Get-Content $envFile
$urlLine = $lines | Where-Object { $_ -match '^VITE_SUPABASE_URL=' } | Select-Object -First 1
$keyLine = $lines | Where-Object { $_ -match '^VITE_SUPABASE_ANON_KEY=' } | Select-Object -First 1
$url = ($urlLine -replace '^VITE_SUPABASE_URL=', '').Trim()
$key = ($keyLine -replace '^VITE_SUPABASE_ANON_KEY=', '').Trim()

if (-not $url -or -not $key) {
    Write-Host "Variaveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nao encontradas no .env" -ForegroundColor Red
    exit 1
}

Set-Location $PSScriptRoot
Write-Host "Adicionando variaveis ao Vercel (Production)..." -ForegroundColor Cyan

$url | npx vercel env add VITE_SUPABASE_URL production
$key | npx vercel env add VITE_SUPABASE_ANON_KEY production

Write-Host ""
Write-Host "Pronto! Faca um novo deploy: npx vercel --prod" -ForegroundColor Green
