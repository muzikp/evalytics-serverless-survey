#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Initialize Evalytics Survey Database
.DESCRIPTION
    Creates database, schema, admin user, and optionally demo data
.PARAMETER Environment
    Target environment: 'dev' (default) or 'prod'
.PARAMETER SkipDemoData
    Skip insertion of demo NPS survey data
.EXAMPLE
    .\init-database.ps1
    Initialize development database with demo data
.EXAMPLE
    .\init-database.ps1 -Environment prod -SkipDemoData
    Initialize production database without demo data
#>

param(
    [Parameter()]
    [ValidateSet('dev', 'prod')]
    [string]$Environment = 'dev',
    
    [Parameter()]
    [switch]$SkipDemoData
)

$ErrorActionPreference = "Stop"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "EVALYTICS SURVEY - DATABASE INITIALIZATION" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Environment: $Environment" -ForegroundColor Yellow

# Load .env file
$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "❌ ERROR: .env file not found at: $envFile" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Found .env file" -ForegroundColor Green

# Parse environment variables
$envVars = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)\s*=\s*(.+)\s*$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        $envVars[$key] = $value
    }
}

# Get database credentials based on environment
if ($Environment -eq 'prod') {
    $dbHost = $envVars['MYSQL_PROD_HOST']
    $dbPort = $envVars['MYSQL_PROD_PORT']
    $dbUser = $envVars['MYSQL_PROD_USER']
    $dbPassword = $envVars['MYSQL_PROD_PASSWORD']
    $dbName = $envVars['MYSQL_PROD_DATABASE']
}
else {
    $dbHost = if ($envVars['MYSQL_DEV_HOST']) { $envVars['MYSQL_DEV_HOST'] } else { $envVars['DB_HOST'] }
    $dbPort = if ($envVars['MYSQL_DEV_PORT']) { $envVars['MYSQL_DEV_PORT'] } else { $envVars['DB_PORT'] }
    $dbUser = if ($envVars['MYSQL_DEV_USER']) { $envVars['MYSQL_DEV_USER'] } else { $envVars['DB_USER'] }
    $dbPassword = if ($envVars['MYSQL_DEV_PASSWORD']) { $envVars['MYSQL_DEV_PASSWORD'] } else { $envVars['DB_PASSWORD'] }
    $dbName = if ($envVars['MYSQL_DEV_DATABASE']) { $envVars['MYSQL_DEV_DATABASE'] } else { $envVars['DB_NAME'] }
}

if (-not $dbHost -or -not $dbUser -or -not $dbPassword -or -not $dbName) {
    Write-Host "❌ ERROR: Missing database configuration in .env" -ForegroundColor Red
    Write-Host "Required: MYSQL_${Environment.ToUpper()}_HOST, USER, PASSWORD, DATABASE" -ForegroundColor Red
    exit 1
}

Write-Host "`n📊 Database Configuration:" -ForegroundColor Cyan
Write-Host "   Host: $dbHost" -ForegroundColor Gray
Write-Host "   Port: $dbPort" -ForegroundColor Gray
Write-Host "   User: $dbUser" -ForegroundColor Gray
Write-Host "   Database: $dbName" -ForegroundColor Gray

# Confirmation for production
if ($Environment -eq 'prod') {
    Write-Host "`n⚠️  WARNING: You are about to initialize PRODUCTION database!" -ForegroundColor Yellow
    Write-Host "This will CREATE/RECREATE the database schema." -ForegroundColor Yellow
    $confirmation = Read-Host "`nType 'YES' to continue"
    if ($confirmation -ne 'YES') {
        Write-Host "Aborted." -ForegroundColor Red
        exit 0
    }
}

# Step 1: Create database if not exists
Write-Host "`n[1/4] Creating database..." -ForegroundColor Cyan
$createDbSql = "CREATE DATABASE IF NOT EXISTS ``$dbName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
try {
    mysql -h $dbHost -P $dbPort -u $dbUser -p"$dbPassword" -e $createDbSql 2>&1 | Out-Null
    Write-Host "✓ Database created/verified" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to create database" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Step 2: Initialize schema
Write-Host "`n[2/4] Initializing schema..." -ForegroundColor Cyan
try {
    node utils/sql/init-schema.js --env $Environment
    if ($LASTEXITCODE -ne 0) { throw "Schema initialization failed" }
}
catch {
    Write-Host "❌ Failed to initialize schema" -ForegroundColor Red
    exit 1
}

# Step 3: Create admin user
Write-Host "`n[3/4] Creating admin user..." -ForegroundColor Cyan
try {
    node utils/sql/create-admin.js --env $Environment
    if ($LASTEXITCODE -ne 0) { throw "Admin creation failed" }
}
catch {
    Write-Host "❌ Failed to create admin user" -ForegroundColor Red
    exit 1
}

# Step 4: Insert demo data (optional)
if (-not $SkipDemoData) {
    Write-Host "`n[4/4] Inserting demo data (NPS survey)..." -ForegroundColor Cyan
    try {
        node utils/sql/insert_nps_direct.js --env $Environment
        if ($LASTEXITCODE -ne 0) { throw "Demo data insertion failed" }
    }
    catch {
        Write-Host "❌ Failed to insert demo data" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "`n[4/4] Skipping demo data (--SkipDemoData flag)" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "✅ DATABASE INITIALIZATION COMPLETE!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Start API: npm run sam:local" -ForegroundColor Gray
Write-Host "  2. Start UI: npm run dev:ui" -ForegroundColor Gray
Write-Host "  3. Login: http://localhost:5174 with credentials from .env`n" -ForegroundColor Gray
