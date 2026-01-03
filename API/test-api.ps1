# Evalytics API Test Script
# Tests all endpoints systematically

$baseUrl = "http://127.0.0.1:3000"
$results = @()

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Uri,
        [object]$Body = $null,
        [hashtable]$Headers = @{}
    )
    
    Write-Host "`n=== Testing: $Name ===" -ForegroundColor Cyan
    Write-Host "$Method $Uri" -ForegroundColor Gray
    
    try {
        $params = @{
            Uri         = $Uri
            Method      = $Method
            Headers     = $Headers
            ContentType = 'application/json'
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
        }
        
        $response = Invoke-RestMethod @params
        Write-Host "✓ Success" -ForegroundColor Green
        
        $script:results += [PSCustomObject]@{
            Name     = $Name
            Method   = $Method
            Uri      = $Uri
            Status   = "✓ SUCCESS"
            Response = $response
        }
        
        return $response
    }
    catch {
        $statusCode = if ($_.Exception.Response.StatusCode.value__) { $_.Exception.Response.StatusCode.value__ } else { "Unknown" }
        Write-Host "✗ Failed: $statusCode" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Yellow
        
        $script:results += [PSCustomObject]@{
            Name     = $Name
            Method   = $Method
            Uri      = $Uri
            Status   = "✗ FAILED ($statusCode)"
            Response = $null
        }
        
        return $null
    }
}

Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "  EVALYTICS API TEST SUITE" -ForegroundColor Magenta
Write-Host "========================================`n" -ForegroundColor Magenta

# 1. Authentication Tests
Write-Host "`n--- 1. AUTHENTICATION ---" -ForegroundColor Yellow

$loginResponse = Test-Endpoint `
    -Name "Login" `
    -Method "POST" `
    -Uri "$baseUrl/auth" `
    -Body @{email = 'muzikp@gmail.com'; password = 'Profesor764' }

if ($loginResponse) {
    $jwtToken = $loginResponse.token
    Write-Host "JWT Token obtained: $($jwtToken.Substring(0,20))..." -ForegroundColor Green
}

Test-Endpoint `
    -Name "Get Current User" `
    -Method "GET" `
    -Uri "$baseUrl/auth/me" `
    -Headers @{Authorization = "Bearer $jwtToken" }

# 2. API Tokens Tests
Write-Host "`n--- 2. API TOKENS ---" -ForegroundColor Yellow

$apiToken = "G-Y44Oz86mWTEbNdhheB52qzBJgdaY5v7Bem3C_xmDw"

Test-Endpoint `
    -Name "List API Tokens" `
    -Method "GET" `
    -Uri "$baseUrl/api-tokens" `
    -Headers @{Authorization = "Bearer $jwtToken" }

# 3. Templates Tests
Write-Host "`n--- 3. TEMPLATES ---" -ForegroundColor Yellow

Test-Endpoint `
    -Name "List Templates" `
    -Method "GET" `
    -Uri "$baseUrl/templates" `
    -Headers @{'X-Api-Token' = $apiToken }

$newTemplate = Test-Endpoint `
    -Name "Create Template" `
    -Method "POST" `
    -Uri "$baseUrl/templates" `
    -Headers @{'X-Api-Token' = $apiToken } `
    -Body @{
    name        = 'Test Template from PowerShell'
    description = 'Automated test'
    languages   = @('cs', 'en')
    data        = @{questions = @(@{id = 'q1'; type = 'text'; text = @{cs = 'Otázka 1'; en = 'Question 1' } }) }
}

if ($newTemplate) {
    $templateId = $newTemplate.template_id
    Write-Host "Created template: $templateId" -ForegroundColor Green
    
    Test-Endpoint `
        -Name "Get Template" `
        -Method "GET" `
        -Uri "$baseUrl/templates/$templateId" `
        -Headers @{'X-Api-Token' = $apiToken }
}

# 4. Snapshots Tests
Write-Host "`n--- 4. SNAPSHOTS ---" -ForegroundColor Yellow

Test-Endpoint `
    -Name "List Snapshots" `
    -Method "GET" `
    -Uri "$baseUrl/snapshots" `
    -Headers @{'X-Api-Token' = $apiToken }

if ($templateId) {
    $newSnapshot = Test-Endpoint `
        -Name "Create Snapshot" `
        -Method "POST" `
        -Uri "$baseUrl/snapshots" `
        -Headers @{'X-Api-Token' = $apiToken } `
        -Body @{
        template_id = $templateId
        languages   = @('cs', 'en')
        data        = @{questions = @(@{id = 'q1'; type = 'text' }) }
    }
    
    if ($newSnapshot) {
        $snapshotId = $newSnapshot.snapshot_id
        Write-Host "Created snapshot: $snapshotId (version $($newSnapshot.version))" -ForegroundColor Green
    }
}

# 5. Campaigns Tests
Write-Host "`n--- 5. CAMPAIGNS ---" -ForegroundColor Yellow

Test-Endpoint `
    -Name "List Campaigns" `
    -Method "GET" `
    -Uri "$baseUrl/campaigns" `
    -Headers @{'X-Api-Token' = $apiToken }

if ($snapshotId) {
    $newCampaign = Test-Endpoint `
        -Name "Create Campaign" `
        -Method "POST" `
        -Uri "$baseUrl/campaigns" `
        -Headers @{'X-Api-Token' = $apiToken } `
        -Body @{
        snapshot_id      = $snapshotId
        title            = @{cs = 'Test kampaň'; en = 'Test Campaign' }
        description      = @{cs = 'Testovací popis'; en = 'Test description' }
        default_language = 'cs'
        valid_from       = (Get-Date).ToString('yyyy-MM-dd')
        valid_until      = (Get-Date).AddMonths(1).ToString('yyyy-MM-dd')
        email_template   = @{
            cs = @{subject = 'Test'; body = 'Test' }
            en = @{subject = 'Test'; body = 'Test' }
        }
    }
    
    if ($newCampaign) {
        $campaignId = $newCampaign.campaign_id
        $publicId = $newCampaign.public_id
        Write-Host "Created campaign: $campaignId (public: $publicId)" -ForegroundColor Green
        
        Test-Endpoint `
            -Name "Get Campaign" `
            -Method "GET" `
            -Uri "$baseUrl/campaigns/$campaignId" `
            -Headers @{'X-Api-Token' = $apiToken }
    }
}

# 6. Campaign Respondents Tests
Write-Host "`n--- 6. CAMPAIGN RESPONDENTS ---" -ForegroundColor Yellow

if ($campaignId) {
    $newRespondent = Test-Endpoint `
        -Name "Add Respondent" `
        -Method "POST" `
        -Uri "$baseUrl/campaigns/$campaignId/respondents" `
        -Headers @{'X-Api-Token' = $apiToken } `
        -Body @{
        email = "test-$(Get-Random)@example.com"
        data  = @{name = 'Test User' }
    }
    
    if ($newRespondent) {
        $respondentToken = $newRespondent.respondent_token
        Write-Host "Respondent token: $($respondentToken.Substring(0,20))..." -ForegroundColor Green
    }
    
    Test-Endpoint `
        -Name "List Respondents" `
        -Method "GET" `
        -Uri "$baseUrl/campaigns/$campaignId/respondents" `
        -Headers @{'X-Api-Token' = $apiToken }
}

# 7. Public Survey Tests
Write-Host "`n--- 7. PUBLIC SURVEY ---" -ForegroundColor Yellow

if ($publicId) {
    Test-Endpoint `
        -Name "Get Survey Info" `
        -Method "GET" `
        -Uri "$baseUrl/survey/$publicId"
    
    Test-Endpoint `
        -Name "Get Survey Questions (cs)" `
        -Method "GET" `
        -Uri "$baseUrl/survey/$publicId/questions?lang=cs"
    
    if ($respondentToken) {
        Test-Endpoint `
            -Name "Submit Response" `
            -Method "POST" `
            -Uri "$baseUrl/survey/$publicId/response" `
            -Headers @{'X-Respondent-Token' = $respondentToken } `
            -Body @{answers = @{q1 = 'Test odpověď' } }
        
        Test-Endpoint `
            -Name "Get Respondent Status" `
            -Method "GET" `
            -Uri "$baseUrl/survey/$publicId/respondent" `
            -Headers @{'X-Respondent-Token' = $respondentToken }
    }
}

# 8. Responses Tests
Write-Host "`n--- 8. RESPONSES ---" -ForegroundColor Yellow

Test-Endpoint `
    -Name "List All Responses" `
    -Method "GET" `
    -Uri "$baseUrl/responses" `
    -Headers @{'X-Api-Token' = $apiToken }

if ($campaignId) {
    Test-Endpoint `
        -Name "List Campaign Responses" `
        -Method "GET" `
        -Uri "$baseUrl/responses?campaign_id=$campaignId" `
        -Headers @{'X-Api-Token' = $apiToken }
}

# 9. Email Audit Tests
Write-Host "`n--- 9. EMAIL AUDIT ---" -ForegroundColor Yellow

if ($campaignId) {
    Test-Endpoint `
        -Name "Get Campaign Email Log" `
        -Method "GET" `
        -Uri "$baseUrl/campaigns/$campaignId/email-log" `
        -Headers @{'X-Api-Token' = $apiToken }
}

# Summary
Write-Host "`n`n========================================" -ForegroundColor Magenta
Write-Host "  TEST SUMMARY" -ForegroundColor Magenta
Write-Host "========================================`n" -ForegroundColor Magenta

$success = ($results | Where-Object { $_.Status -like "*SUCCESS*" }).Count
$failed = ($results | Where-Object { $_.Status -like "*FAILED*" }).Count
$total = $results.Count

Write-Host "Total tests: $total" -ForegroundColor White
Write-Host "Passed: $success" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red
Write-Host "Success rate: $([math]::Round($success/$total*100,1))%`n" -ForegroundColor Cyan

# Detailed results
$results | Format-Table -AutoSize Name, Method, Status

Write-Host "`nTest completed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
