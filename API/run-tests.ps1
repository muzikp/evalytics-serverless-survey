# Evalytics API - Comprehensive Test Suite
# Run this after starting SAM local API server on port 3000

$baseUrl = "http://127.0.0.1:3000"
$apiToken = "G-Y44Oz86mWTEbNdhheB52qzBJgdaY5v7Bem3C_xmDw"
$results = @()

Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "  EVALYTICS API COMPREHENSIVE TEST" -ForegroundColor Magenta
Write-Host "========================================`n" -ForegroundColor Magenta

# Test 1: Login
Write-Host "[1] POST /auth (Login)" -ForegroundColor Cyan
try {
    $body = @{email='muzikp@gmail.com'; password='Profesor764'} | ConvertTo-Json
    $loginResp = Invoke-RestMethod -Uri "$baseUrl/auth" -Method POST -Body $body -ContentType 'application/json'
    $jwtToken = $loginResp.token
    Write-Host " OK - JWT received`n" -ForegroundColor Green
    $results += "[OK] POST /auth"
} catch {
    Write-Host " FAILED - $_`n" -ForegroundColor Red
    $results += "[FAIL] POST /auth"
}

# Test 2: Get Current User
Write-Host "[2] GET /auth/me" -ForegroundColor Cyan
try {
    $meResp = Invoke-RestMethod -Uri "$baseUrl/auth/me" -Method GET -Headers @{Authorization="Bearer $jwtToken"}
    Write-Host " OK - User: $($meResp.user.email)`n" -ForegroundColor Green
    $results += "[OK] GET /auth/me"
} catch {
    Write-Host " FAILED - $_`n" -ForegroundColor Red
    $results += "[FAIL] GET /auth/me"
}

# Test 3: List API Tokens
Write-Host "[3] GET /api-tokens" -ForegroundColor Cyan
try {
    $tokensResp = Invoke-RestMethod -Uri "$baseUrl/api-tokens" -Method GET -Headers @{Authorization="Bearer $jwtToken"}
    Write-Host " OK - Found $($tokensResp.items.Count) tokens`n" -ForegroundColor Green
    $results += "[OK] GET /api-tokens"
} catch {
    Write-Host " FAILED - $_`n" -ForegroundColor Red
    $results += "[FAIL] GET /api-tokens"
}

# Test 4: List Templates
Write-Host "[4] GET /templates" -ForegroundColor Cyan
try {
    $templatesResp = Invoke-RestMethod -Uri "$baseUrl/templates" -Method GET -Headers @{'X-Api-Token'=$apiToken}
    Write-Host " OK - Found $($templatesResp.items.Count) templates`n" -ForegroundColor Green
    $results += "[OK] GET /templates"
} catch {
    Write-Host " FAILED - $_`n" -ForegroundColor Red
    $results += "[FAIL] GET /templates"
}

# Test 5: Create Template
Write-Host "[5] POST /templates" -ForegroundColor Cyan
try {
    $body = @{
        name="PowerShell Test $(Get-Date -Format 'HH:mm:ss')"
        description="Auto test"
        languages=@('cs','en')
        data=@{questions=@(@{id='q1';type='text';text=@{cs='Otazka';en='Question'}})}
    } | ConvertTo-Json -Depth 10
    $newTpl = Invoke-RestMethod -Uri "$baseUrl/templates" -Method POST -Body $body -ContentType 'application/json' -Headers @{'X-Api-Token'=$apiToken}
    $templateId = $newTpl.template_id
    Write-Host " OK - Created: $templateId`n" -ForegroundColor Green
    $results += "[OK] POST /templates"
} catch {
    Write-Host " FAILED - $_`n" -ForegroundColor Red
    $results += "[FAIL] POST /templates"
}

# Test 6: Get Template by ID
if ($templateId) {
    Write-Host "[6] GET /templates/$templateId" -ForegroundColor Cyan
    try {
        $tpl = Invoke-RestMethod -Uri "$baseUrl/templates/$templateId" -Method GET -Headers @{'X-Api-Token'=$apiToken}
        Write-Host " OK - Name: $($tpl.name)`n" -ForegroundColor Green
        $results += "[OK] GET /templates/:id"
    } catch {
        Write-Host " FAILED - $_`n" -ForegroundColor Red
        $results += "[FAIL] GET /templates/:id"
    }
}

# Test 7: List Snapshots
Write-Host "[7] GET /snapshots" -ForegroundColor Cyan
try {
    $snapshotsResp = Invoke-RestMethod -Uri "$baseUrl/snapshots" -Method GET -Headers @{'X-Api-Token'=$apiToken}
    Write-Host " OK - Found $($snapshotsResp.items.Count) snapshots`n" -ForegroundColor Green
    $results += "[OK] GET /snapshots"
} catch {
    Write-Host " FAILED - $_`n" -ForegroundColor Red
    $results += "[FAIL] GET /snapshots"
}

# Test 8: Create Snapshot
if ($templateId) {
    Write-Host "[8] POST /snapshots" -ForegroundColor Cyan
    try {
        $body = @{
            template_id=$templateId
            languages=@('cs','en')
            data=@{questions=@(@{id='q1';type='text'})}
        } | ConvertTo-Json -Depth 10
        $newSnap = Invoke-RestMethod -Uri "$baseUrl/snapshots" -Method POST -Body $body -ContentType 'application/json' -Headers @{'X-Api-Token'=$apiToken}
        $snapshotId = $newSnap.snapshot_id
        Write-Host " OK - Created: $snapshotId v$($newSnap.version)`n" -ForegroundColor Green
        $results += "[OK] POST /snapshots"
    } catch {
        Write-Host " FAILED - $_`n" -ForegroundColor Red
        $results += "[FAIL] POST /snapshots"
    }
}

# Test 9: List Campaigns
Write-Host "[9] GET /campaigns" -ForegroundColor Cyan
try {
    $campaignsResp = Invoke-RestMethod -Uri "$baseUrl/campaigns" -Method GET -Headers @{'X-Api-Token'=$apiToken}
    Write-Host " OK - Found $($campaignsResp.items.Count) campaigns`n" -ForegroundColor Green
    $results += "[OK] GET /campaigns"
} catch {
    Write-Host " FAILED - $_`n" -ForegroundColor Red
    $results += "[FAIL] GET /campaigns"
}

# Test 10: Create Campaign
if ($snapshotId) {
    Write-Host "[10] POST /campaigns" -ForegroundColor Cyan
    try {
        $body = @{
            snapshot_id=$snapshotId
            title=@{cs="Test kampan";en="Test Campaign"}
            description=@{cs="Popis";en="Description"}
            default_language='cs'
            valid_from=(Get-Date).ToString('yyyy-MM-dd')
            valid_until=(Get-Date).AddMonths(1).ToString('yyyy-MM-dd')
            email_template=@{cs=@{subject='Test';body='Telo'};en=@{subject='Test';body='Body'}}
        } | ConvertTo-Json -Depth 10
        $newCamp = Invoke-RestMethod -Uri "$baseUrl/campaigns" -Method POST -Body $body -ContentType 'application/json' -Headers @{'X-Api-Token'=$apiToken}
        $campaignId = $newCamp.campaign_id
        $publicId = $newCamp.public_id
        Write-Host " OK - Created: $campaignId`n" -ForegroundColor Green
        $results += "[OK] POST /campaigns"
    } catch {
        Write-Host " FAILED - $_`n" -ForegroundColor Red
        $results += "[FAIL] POST /campaigns"
    }
}

# Test 11: Get Campaign
if ($campaignId) {
    Write-Host "[11] GET /campaigns/$campaignId" -ForegroundColor Cyan
    try {
        $camp = Invoke-RestMethod -Uri "$baseUrl/campaigns/$campaignId" -Method GET -Headers @{'X-Api-Token'=$apiToken}
        Write-Host " OK - Found campaign`n" -ForegroundColor Green
        $results += "[OK] GET /campaigns/:id"
    } catch {
        Write-Host " FAILED - $_`n" -ForegroundColor Red
        $results += "[FAIL] GET /campaigns/:id"
    }
}

# Test 12: Add Respondent
if ($campaignId) {
    Write-Host "[12] POST /campaigns/$campaignId/respondents" -ForegroundColor Cyan
    try {
        $body = @{email="test-$(Get-Random)@example.com";data=@{name='Test User'}} | ConvertTo-Json
        $newResp = Invoke-RestMethod -Uri "$baseUrl/campaigns/$campaignId/respondents" -Method POST -Body $body -ContentType 'application/json' -Headers @{'X-Api-Token'=$apiToken}
        $respondentToken = $newResp.respondent_token
        Write-Host " OK - Token: $($respondentToken.Substring(0,15))...`n" -ForegroundColor Green
        $results += "[OK] POST /campaigns/:id/respondents"
    } catch {
        Write-Host " FAILED - $_`n" -ForegroundColor Red
        $results += "[FAIL] POST /campaigns/:id/respondents"
    }
}

# Test 13: List Respondents
if ($campaignId) {
    Write-Host "[13] GET /campaigns/$campaignId/respondents" -ForegroundColor Cyan
    try {
        $respsResp = Invoke-RestMethod -Uri "$baseUrl/campaigns/$campaignId/respondents" -Method GET -Headers @{'X-Api-Token'=$apiToken}
        Write-Host " OK - Found $($respsResp.items.Count) respondents`n" -ForegroundColor Green
        $results += "[OK] GET /campaigns/:id/respondents"
    } catch {
        Write-Host " FAILED - $_`n" -ForegroundColor Red
        $results += "[FAIL] GET /campaigns/:id/respondents"
    }
}

# Test 14: Get Survey Info (Public)
if ($publicId) {
    Write-Host "[14] GET /survey/$publicId" -ForegroundColor Cyan
    try {
        $surveyInfo = Invoke-RestMethod -Uri "$baseUrl/survey/$publicId" -Method GET
        Write-Host " OK - Language: $($surveyInfo.default_language)`n" -ForegroundColor Green
        $results += "[OK] GET /survey/:publicId"
    } catch {
        Write-Host " FAILED - $_`n" -ForegroundColor Red
        $results += "[FAIL] GET /survey/:publicId"
    }
}

# Test 15: Get Survey Questions (Public)
if ($publicId) {
    Write-Host "[15] GET /survey/$publicId/questions?lang=cs" -ForegroundColor Cyan
    try {
        $questions = Invoke-RestMethod -Uri "$baseUrl/survey/$publicId/questions?lang=cs" -Method GET
        Write-Host " OK - Questions: $($questions.questions.Count)`n" -ForegroundColor Green
        $results += "[OK] GET /survey/:publicId/questions"
    } catch {
        Write-Host " FAILED - $_`n" -ForegroundColor Red
        $results += "[FAIL] GET /survey/:publicId/questions"
    }
}

# Test 16: Submit Response (Public)
if ($publicId -and $respondentToken) {
    Write-Host "[16] POST /survey/$publicId/response" -ForegroundColor Cyan
    try {
        $body = @{answers=@{q1='Test answer from PowerShell'}} | ConvertTo-Json
        $submitResp = Invoke-RestMethod -Uri "$baseUrl/survey/$publicId/response" -Method POST -Body $body -ContentType 'application/json' -Headers @{'X-Respondent-Token'=$respondentToken}
        Write-Host " OK - Response submitted`n" -ForegroundColor Green
        $results += "[OK] POST /survey/:publicId/response"
    } catch {
        Write-Host " FAILED - $_`n" -ForegroundColor Red
        $results += "[FAIL] POST /survey/:publicId/response"
    }
}

# Test 17: Get Respondent Status (Public)
if ($publicId -and $respondentToken) {
    Write-Host "[17] GET /survey/$publicId/respondent" -ForegroundColor Cyan
    try {
        $status = Invoke-RestMethod -Uri "$baseUrl/survey/$publicId/respondent" -Method GET -Headers @{'X-Respondent-Token'=$respondentToken}
        Write-Host " OK - Submitted: $($status.submitted)`n" -ForegroundColor Green
        $results += "[OK] GET /survey/:publicId/respondent"
    } catch {
        Write-Host " FAILED - $_`n" -ForegroundColor Red
        $results += "[FAIL] GET /survey/:publicId/respondent"
    }
}

# Test 18: List All Responses
Write-Host "[18] GET /responses" -ForegroundColor Cyan
try {
    $allResponses = Invoke-RestMethod -Uri "$baseUrl/responses" -Method GET -Headers @{'X-Api-Token'=$apiToken}
    Write-Host " OK - Found $($allResponses.items.Count) responses`n" -ForegroundColor Green
    $results += "[OK] GET /responses"
} catch {
    Write-Host " FAILED - $_`n" -ForegroundColor Red
    $results += "[FAIL] GET /responses"
}

# Test 19: List Campaign Responses
if ($campaignId) {
    Write-Host "[19] GET /responses?campaign_id=$campaignId" -ForegroundColor Cyan
    try {
        $campResponses = Invoke-RestMethod -Uri "$baseUrl/responses?campaign_id=$campaignId" -Method GET -Headers @{'X-Api-Token'=$apiToken}
        Write-Host " OK - Found $($campResponses.items.Count) responses`n" -ForegroundColor Green
        $results += "[OK] GET /responses?campaign_id=..."
    } catch {
        Write-Host " FAILED - $_`n" -ForegroundColor Red
        $results += "[FAIL] GET /responses?campaign_id=..."
    }
}

# Test 20: Get Campaign Email Log
if ($campaignId) {
    Write-Host "[20] GET /campaigns/$campaignId/email-log" -ForegroundColor Cyan
    try {
        $emailLog = Invoke-RestMethod -Uri "$baseUrl/campaigns/$campaignId/email-log" -Method GET -Headers @{'X-Api-Token'=$apiToken}
        Write-Host " OK - Found $($emailLog.items.Count) email logs`n" -ForegroundColor Green
        $results += "[OK] GET /campaigns/:id/email-log"
    } catch {
        Write-Host " FAILED - $_`n" -ForegroundColor Red
        $results += "[FAIL] GET /campaigns/:id/email-log"
    }
}

# Summary
Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "  TEST SUMMARY" -ForegroundColor Magenta
Write-Host "========================================`n" -ForegroundColor Magenta

$passed = ($results | Where-Object {$_ -like "[OK]*"}).Count
$failed = ($results | Where-Object {$_ -like "[FAIL]*"}).Count
$total = $results.Count

Write-Host "Total: $total | Passed: $passed | Failed: $failed" -ForegroundColor White
if ($total -gt 0) {
    $pct = [math]::Round($passed/$total*100,1)
    Write-Host "Success rate: $pct%`n" -ForegroundColor $(if ($pct -eq 100) {'Green'} else {'Yellow'})
}

$results | ForEach-Object { Write-Host "  $_" }

Write-Host "`nCompleted at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
