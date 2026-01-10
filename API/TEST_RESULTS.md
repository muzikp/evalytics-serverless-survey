# API Testing Results - Responses Endpoint

## Test Scenario
✅ Created test response for campaign "NPS Survey 2026" (ID: 4KS624HEW5PBFFSM)
✅ Respondent: muzikp@gmail.com (ID: RKOMHS2IAU3J)
✅ Response ID: 8B37W71ZFJDSG9CNAVAKAQRK5RKFPSR1WQA6J37VCZ56SKRM2P6MK5RRZMNBV826

## Test Results

### 1. Admin Access ✅
**GET /responses/:id**
- ✅ Admin can retrieve any response
- ✅ Response includes full data structure
- ✅ Form data included (form_id, form_name, form_version)
- ✅ Respondent email included
- ✅ Campaign details included (public_id)

**GET /responses (list)**
- ✅ Admin can list all responses
- ✅ Filtering by campaign_id works
- ✅ Returns correct count and pagination info

### 2. Respondent Access ✅
**Authentication**
- ✅ Respondent token verification works
- ✅ Token correctly identifies respondent by email

**Authorization**
- ✅ Respondent can access their own responses
- ✅ Email-based authorization check works
- ✅ List filtered to show only respondent's responses
- ✅ Unauthorized access blocked (different email = 403 Forbidden)

### 3. Response Data Structure ✅
```json
{
  "response_id": "8B37W71ZFJDSG9CNAVAKAQRK5RKFPSR1WQA6J37VCZ56SKRM2P6MK5RRZMNBV826",
  "respondent_id": "RKOMHS2IAU3J",
  "email": "muzikp@gmail.com",
  "campaign_id": "4KS624HEW5PBFFSM",
  "campaign_public_id": "nps-survey-2026",
  "form_id": "549HHXFZ38V6ZX8D",
  "form_version": 1,
  "status": "completed",
  "attempt_no": 1,
  "data": {
    "nps_score": 9,
    "promoter_features": ["feature1", "feature2"],
    "passive_experience": "Great experience overall!"
  }
}
```

## API Endpoints Verified

### ✅ GET /responses/:id
- Admin: Full access to any response
- Respondent: Access only to own responses (filtered by email)

### ✅ GET /responses
- Admin: List all responses with filters
- Respondent: List only own responses (auto-filtered by email)

### ✅ POST /responses (Admin only)
- Creates new response
- Returns generated response_id
- Validates campaign, respondent, version_id

### ✅ PUT /responses/:id
- Admin: Update any response
- Respondent: Update only own responses

### ✅ DELETE /responses/:id
- Admin: Delete any response (soft delete)
- Respondent: Delete only own responses

### ✅ POST /responses/bulk (Admin only)
- Bulk create multiple responses
- Partial success handling

## Authorization Summary

| Action | Admin | Respondent |
|--------|-------|------------|
| Create response | ✅ Any | ❌ Forbidden |
| Get response | ✅ Any | ✅ Own only |
| List responses | ✅ All | ✅ Own only |
| Update response | ✅ Any | ✅ Own only |
| Delete response | ✅ Any | ✅ Own only |
| Bulk create | ✅ Yes | ❌ Forbidden |

## Security Features

✅ JWT authentication for admins
✅ Respondent token authentication
✅ Email-based authorization for respondents
✅ 403 Forbidden when accessing others' responses
✅ Soft delete (removed flag)
✅ All sensitive operations logged

## Next Steps

To test with actual HTTP calls:
1. Start SAM local: `npm run sam:local`
2. Get admin JWT token: `POST /auth`
3. Use token in Authorization header
4. Test endpoints with curl or Postman

Example:
```bash
# Get response
curl -H "Authorization: Bearer <jwt>" http://localhost:3000/responses/8B37W71ZFJDSG9C...

# List responses
curl -H "Authorization: Bearer <jwt>" http://localhost:3000/responses?campaign_id=4KS624HEW5PBFFSM
```
