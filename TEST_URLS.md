# Test URLs and Credentials

## Seed Data Summary
Successfully loaded comprehensive test data with 2 multilingual surveys, 6 respondents, and 6 completed responses.

## Test Campaigns

### 1. Customer Satisfaction Survey (Public, Multilingual EN + CS)
- **Campaign ID**: `camp_satisf_01`
- **Public ID**: `zpetna-vazba-zakazniku-2026`
- **Languages**: English (default), Czech
- **Settings**:
  - Public: Yes
  - Allow retries: Yes
  - Can edit after submit: Yes
  - Can reopen after submit: Yes

**Test URLs** (with tokens):
1. Customer 1: http://localhost:5174/survey/zpetna-vazba-zakazniku-2026?token=a8f3c9d2e1b4567890abcdef12345678
   - Email: customer1@example.com
   - Status: Completed response exists
   - Expected: Survey loads with existing data, can edit and resubmit

2. Customer 2: http://localhost:5174/survey/zpetna-vazba-zakazniku-2026?token=b7e2d8c1f0a3456789bcdef123456789
   - Email: customer2@example.com
   - Status: Completed response exists
   - Expected: Survey loads with existing data, can edit and resubmit

3. Customer 3: http://localhost:5174/survey/zpetna-vazba-zakazniku-2026?token=c6d1e7b0f9a2345678cdef1234567890
   - Email: customer3@example.com
   - Status: Completed response exists
   - Expected: Survey loads with existing data, can edit and resubmit

**Test without token** (public survey):
- URL: http://localhost:5174/survey/zpetna-vazba-zakazniku-2026
- Expected: Survey loads without pre-populated data, allows submission

### 2. Employee Satisfaction Survey (Private, Czech Only)
- **Campaign ID**: `camp_employ_01`
- **Public ID**: `pruzkum-zamestancu-2026`
- **Languages**: Czech only
- **Settings**:
  - Public: No (private, invite-only)
  - Allow retries: No (single attempt)
  - Can edit after submit: **No** (read-only after submit)
  - Can reopen after submit: **No** (redirect to home after submit)

**Test URLs** (with tokens):
1. Jan Novák: http://localhost:5174/survey/pruzkum-zamestancu-2026?token=d5c0e6b9f8a1234567def0123456789a
   - Email: jan.novak@company.com
   - Status: Completed response exists
   - Expected: **Redirects to homepage** with toast "This survey has already been submitted"

2. Marie Svobodová: http://localhost:5174/survey/pruzkum-zamestancu-2026?token=e4b9d5c8f7a0123456ef01234567890b
   - Email: marie.svobodova@company.com
   - Status: Completed response exists
   - Expected: **Redirects to homepage** with toast message

3. Petr Dvořák: http://localhost:5174/survey/pruzkum-zamestancu-2026?token=f3a8c4b7d6e9012345f012345678901c
   - Email: petr.dvorak@company.com
   - Status: Completed response exists
   - Expected: **Redirects to homepage** with toast message

**Test without token** (private survey):
- URL: http://localhost:5174/survey/pruzkum-zamestancu-2026
- Expected: Error or message that survey is private/requires token

## Admin Access
- URL: http://localhost:5174/admin
- Email: muzikp@gmail.com
- Password: Profesor764

## Test Scenarios

### Scenario 1: Multilingual Survey (Customer Satisfaction)
1. Open customer satisfaction survey with token
2. Verify survey displays in English by default
3. Change browser language to Czech or use language selector
4. Verify all text translates to Czech
5. Modify some answers
6. Submit survey
7. Verify success message
8. Reopen same URL
9. Verify: Survey shows updated answers and is still editable

### Scenario 2: Post-Submit Controls (Employee Survey)
1. Open employee survey with any token (all have completed responses)
2. Expected behavior: Immediate redirect to homepage
3. Verify toast message appears
4. Verify cannot access survey after completion

### Scenario 3: Response Persistence
1. Create new test respondent or use existing token without response
2. Fill out survey partially
3. Don't submit - just close browser
4. Reopen same URL with token
5. Verify: Previous answers are pre-populated
6. Complete and submit
7. Verify: Response saved to database

### Scenario 4: Survey Submission Flow
1. Open any survey
2. Fill out completely
3. Click Submit
4. Verify: Spinner shows "Submitting your response..."
5. Verify: Survey becomes read-only during submission
6. Verify: Success toast appears
7. Verify: Spinner disappears

### Scenario 5: Error Handling
1. Stop API server
2. Try to submit survey
3. Verify: Error message appears
4. Verify: Survey re-enables for editing
5. Restart API
6. Retry submission
7. Verify: Success

## Database Verification

Check responses:
```sql
SELECT 
  r.response_id,
  r.status,
  cr.email,
  c.public_id,
  r.submitted_at
FROM responses r
JOIN campaign_respondents cr ON r.respondent_id = cr.respondent_id
JOIN campaigns c ON r.campaign_id = c.campaign_id
ORDER BY r.submitted_at DESC;
```

Check tokens:
```sql
SELECT 
  cr.email,
  JSON_EXTRACT(cr.data, '$.token') as token,
  c.public_id
FROM campaign_respondents cr
JOIN campaigns c ON cr.campaign_id = c.campaign_id;
```

## Notes
- All tokens are 32-character random hex strings (no "token=" prefix)
- Customer survey allows editing and reopening after submit
- Employee survey strictly prevents access after submission
- Response data includes `request_data` (sessions, time spent) and `client_meta` (user agent, screen size)
- All test respondents have completed responses to test post-submit behavior
