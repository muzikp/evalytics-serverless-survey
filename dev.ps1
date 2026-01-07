#!/usr/bin/env pwsh
# Development startup script - spustí API a UI lokálně

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "🚀 Starting Evalytics Development" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Cleanup old processes
Write-Host "🧹 Cleaning up old processes..." -ForegroundColor Yellow
Get-Process -Name node, sam -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -like '*evalytics*' -or $_.CommandLine -like '*vite*' -or $_.CommandLine -like '*sam*'
} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Build API first
Write-Host "📦 Building API..." -ForegroundColor Yellow
Push-Location API
sam build --quiet 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ API build failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "✅ API built" -ForegroundColor Green

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Starting services..." -ForegroundColor White
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Start API in new window with warm containers
Write-Host "🔥 Starting API (warm containers)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-Command',
    "Write-Host ''; Write-Host '🚀 API Server' -ForegroundColor Green; Write-Host '📍 http://127.0.0.1:3000' -ForegroundColor Yellow; Write-Host ''; cd '$PWD/API'; sam local start-api --port 3000 --template .aws-sam/build/template.yaml --env-vars env.json --warm-containers EAGER --skip-pull-image"
)

# Wait for API to be ready
Write-Host "⏳ Waiting for API to start..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$apiReady = $false

while ($attempt -lt $maxAttempts -and -not $apiReady) {
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
        $apiReady = $true
    }
    catch {
        Start-Sleep -Seconds 1
        $attempt++
    }
}

if ($apiReady) {
    Write-Host "✅ API is ready" -ForegroundColor Green
}
else {
    Write-Host "⚠️  API health check timeout (continuing anyway)" -ForegroundColor Yellow
}

# Start UI in new window
Write-Host "🎨 Starting UI..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-Command',
    "Write-Host ''; Write-Host '🎨 UI Dev Server' -ForegroundColor Green; Write-Host '📍 http://localhost:5174' -ForegroundColor Yellow; Write-Host ''; cd '$PWD/UI'; npm run dev"
)

# Wait a bit for UI to start
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "✅ Development servers started!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔥 API:  " -NoNewline -ForegroundColor White
Write-Host "http://localhost:3000" -ForegroundColor Yellow
Write-Host "   Features: Warm containers, Skip pull image" -ForegroundColor DarkGray
Write-Host ""
Write-Host "🎨 UI:   " -NoNewline -ForegroundColor White
Write-Host "http://localhost:5174" -ForegroundColor Yellow
Write-Host "   Features: Hot reload, Fast refresh" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Press Ctrl+C to stop this script" -ForegroundColor DarkGray
Write-Host "(Note: Services will continue running in separate windows)" -ForegroundColor DarkGray
Write-Host ""

# Keep script running
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    Write-Host ""
    Write-Host "Script stopped. Services still running in separate windows." -ForegroundColor Yellow
}
