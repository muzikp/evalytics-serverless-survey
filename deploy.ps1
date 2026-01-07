#!/usr/bin/env pwsh
param(
    [switch]$SkipUI,
    [switch]$SkipAPI,
    [string]$CommitMessage = "chore: Deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
)

$ErrorActionPreference = "Stop"
$rootDir = $PSScriptRoot

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "EVALYTICS SURVEY - DEPLOYMENT" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Load .env file
$envFile = Join-Path $rootDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: .env file not found" -ForegroundColor Red
    exit 1
}

$envVars = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)\s*=\s*(.+)\s*$') {
        $envVars[$matches[1].Trim()] = $matches[2].Trim()
    }
}

$awsRegion = $envVars['AWS_REGION']
$awsAccountId = $envVars['AWS_ACCOUNT_ID']

Write-Host "AWS Region: $awsRegion" -ForegroundColor Yellow
Write-Host "AWS Account: $awsAccountId" -ForegroundColor Yellow
Write-Host "Commit Message: $CommitMessage`n" -ForegroundColor Yellow

# UI DEPLOYMENT
if (-not $SkipUI) {
    Write-Host "`n[1/2] DEPLOYING UI" -ForegroundColor Cyan
    Write-Host "======================================`n" -ForegroundColor Cyan
    
    Set-Location (Join-Path $rootDir "UI")
    
    Write-Host "Checking git status..." -ForegroundColor Gray
    $gitStatus = git status --porcelain
    if ($gitStatus) {
        Write-Host "Found uncommitted changes" -ForegroundColor Green
    }
    
    Write-Host "`nBuilding UI..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "UI build failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "UI build complete" -ForegroundColor Green
    
    Write-Host "`nPushing to GitHub..." -ForegroundColor Cyan
    Set-Location $rootDir
    
    git add .
    git commit -m $CommitMessage
    git push origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Git push failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "Pushed to GitHub" -ForegroundColor Green
}

if ($SkipUI) {
    Write-Host "`n[1/2] SKIPPING UI DEPLOYMENT" -ForegroundColor Yellow
}

# API DEPLOYMENT
if (-not $SkipAPI) {
    Write-Host "`n[2/2] DEPLOYING API" -ForegroundColor Cyan
    Write-Host "======================================`n" -ForegroundColor Cyan
    
    Set-Location (Join-Path $rootDir "API")
    
    $env:AWS_ACCESS_KEY_ID = $envVars['AWS_ACCESS_KEY']
    $env:AWS_SECRET_ACCESS_KEY = $envVars['AWS_SECRET_KEY']
    $env:AWS_DEFAULT_REGION = $awsRegion
    
    Write-Host "Building SAM application..." -ForegroundColor Cyan
    sam build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "SAM build failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "SAM build complete" -ForegroundColor Green
    
    Write-Host "`nDeploying to AWS Lambda..." -ForegroundColor Cyan
    $stackName = "evalytics-survey-api-prod"
    
    sam deploy --stack-name $stackName --region $awsRegion --capabilities CAPABILITY_IAM --no-fail-on-empty-changeset --resolve-s3 --parameter-overrides "DbHost=$($envVars['MYSQL_PROD_HOST'])" "DbPort=$($envVars['MYSQL_PROD_PORT'])" "DbUser=$($envVars['MYSQL_PROD_USER'])" "DbPassword=$($envVars['MYSQL_PROD_PASSWORD'])" "DbName=$($envVars['MYSQL_PROD_DATABASE'])" "SesFromEmail=$($envVars['SES_FROM_EMAIL'])"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "SAM deployment failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "API deployed successfully" -ForegroundColor Green
    
    Write-Host "`nGetting API endpoint..." -ForegroundColor Cyan
    $apiUrl = aws cloudformation describe-stacks --stack-name $stackName --region $awsRegion --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
    
    if ($apiUrl) {
        Write-Host "API URL: $apiUrl" -ForegroundColor Green
    }
}

if ($SkipAPI) {
    Write-Host "`n[2/2] SKIPPING API DEPLOYMENT" -ForegroundColor Yellow
}

# SUMMARY
Set-Location $rootDir

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green
