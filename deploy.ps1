#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploy Evalytics Survey (UI + API) to Production
.DESCRIPTION
    Builds and deploys UI to GitHub and API to AWS Lambda (SAM)
.PARAMETER SkipUI
    Skip UI build and GitHub push
.PARAMETER SkipAPI
    Skip API build and AWS SAM deployment
.PARAMETER CommitMessage
    Custom git commit message
.EXAMPLE
    .\deploy.ps1
    Deploy both UI and API with default commit message
.EXAMPLE
    .\deploy.ps1 -SkipUI
    Deploy only API
.EXAMPLE
    .\deploy.ps1 -CommitMessage "feat: Added NPS survey module"
    Deploy with custom commit message
#>

param(
    [Parameter()]
    [switch]$SkipUI,
    
    [Parameter()]
    [switch]$SkipAPI,
    
    [Parameter()]
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
    Write-Host "❌ ERROR: .env file not found" -ForegroundColor Red
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

# ============================================
# 1. UI DEPLOYMENT (GitHub)
# ============================================
if (-not $SkipUI) {
    Write-Host "`n[1/2] 🎨 DEPLOYING UI" -ForegroundColor Cyan
    Write-Host "======================================`n" -ForegroundColor Cyan
    
    Set-Location (Join-Path $rootDir "UI")
    
    # Check git status
    Write-Host "📊 Checking git status..." -ForegroundColor Gray
    $gitStatus = git status --porcelain
    if ($gitStatus) {
        Write-Host "✓ Found uncommitted changes" -ForegroundColor Green
    } else {
        Write-Host "⚠️  No changes to commit" -ForegroundColor Yellow
    }
    
    # Build UI
    Write-Host "`n📦 Building UI..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ UI build failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ UI build complete" -ForegroundColor Green
    
    # Git commit and push
    Write-Host "`n📤 Pushing to GitHub..." -ForegroundColor Cyan
    Set-Location $rootDir
    
    git add .
    git commit -m $CommitMessage
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Committed changes" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Nothing to commit (or commit failed)" -ForegroundColor Yellow
    }
    
    git push origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Git push failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Pushed to GitHub" -ForegroundColor Green
    
} else {
    Write-Host "`n[1/2] ⏭️  SKIPPING UI DEPLOYMENT" -ForegroundColor Yellow
}

# ============================================
# 2. API DEPLOYMENT (AWS Lambda SAM)
# ============================================
if (-not $SkipAPI) {
    Write-Host "`n[2/2] 🚀 DEPLOYING API" -ForegroundColor Cyan
    Write-Host "======================================`n" -ForegroundColor Cyan
    
    Set-Location (Join-Path $rootDir "API")
    
    # Set AWS credentials from .env
    $env:AWS_ACCESS_KEY_ID = $envVars['AWS_ACCESS_KEY']
    $env:AWS_SECRET_ACCESS_KEY = $envVars['AWS_SECRET_KEY']
    $env:AWS_DEFAULT_REGION = $awsRegion
    
    # SAM Build
    Write-Host "🔨 Building SAM application..." -ForegroundColor Cyan
    sam build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ SAM build failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ SAM build complete" -ForegroundColor Green
    
    # SAM Deploy
    Write-Host "`n🚀 Deploying to AWS Lambda..." -ForegroundColor Cyan
    $stackName = "evalytics-survey-api-prod"
    
    # Deploy with parameter overrides from .env
    sam deploy `
        --stack-name $stackName `
        --region $awsRegion `
        --capabilities CAPABILITY_IAM `
        --no-fail-on-empty-changeset `
        --parameter-overrides `
            "DbHost=$($envVars['MYSQL_PROD_HOST'])" `
            "DbPort=$($envVars['MYSQL_PROD_PORT'])" `
            "DbUser=$($envVars['MYSQL_PROD_USER'])" `
            "DbPassword=$($envVars['MYSQL_PROD_PASSWORD'])" `
            "DbName=$($envVars['MYSQL_PROD_DATABASE'])" `
            "SesFromEmail=$($envVars['SES_FROM_EMAIL'])"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ SAM deployment failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ API deployed successfully" -ForegroundColor Green
    
    # Get API URL
    Write-Host "`n📋 Getting API endpoint..." -ForegroundColor Cyan
    $apiUrl = aws cloudformation describe-stacks `
        --stack-name $stackName `
        --region $awsRegion `
        --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" `
        --output text
    
    if ($apiUrl) {
        Write-Host "✓ API URL: $apiUrl" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Could not retrieve API URL from CloudFormation outputs" -ForegroundColor Yellow
    }
    
} else {
    Write-Host "`n[2/2] ⏭️  SKIPPING API DEPLOYMENT" -ForegroundColor Yellow
}

# ============================================
# SUMMARY
# ============================================
Set-Location $rootDir

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "✅ DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

if (-not $SkipUI) {
    Write-Host "UI:" -ForegroundColor Cyan
    Write-Host "  ✓ Built and pushed to GitHub" -ForegroundColor Gray
    Write-Host "  📍 GitHub Pages: https://github.com/yourusername/evalytics-serverless-survey" -ForegroundColor Gray
}

if (-not $SkipAPI) {
    Write-Host "`nAPI:" -ForegroundColor Cyan
    Write-Host "  ✓ Deployed to AWS Lambda (SAM)" -ForegroundColor Gray
    if ($apiUrl) {
        Write-Host "  📍 Endpoint: $apiUrl" -ForegroundColor Gray
    }
    Write-Host "  🔧 CloudFormation Stack: $stackName" -ForegroundColor Gray
}

Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Configure Route53 DNS records (see ROUTE53-CONFIG.md)" -ForegroundColor Gray
Write-Host "  2. Test API endpoint: curl $apiUrl/health" -ForegroundColor Gray
Write-Host "  3. Verify UI loads at production URL`n" -ForegroundColor Gray
