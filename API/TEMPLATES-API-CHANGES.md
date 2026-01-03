# Templates API - Response Structure Update

## Changes Made (2026-01-03)

### Modified Files
1. `API/src/handlers/templates.js` - Updated response structure
2. `docs/openapi.yaml` - Updated API documentation schemas

### Changes to `/templates` Endpoints

#### Removed Properties from Responses:
- ❌ `created_by_firstname` - No longer returned
- ❌ `created_by_lastname` - No longer returned  
- ❌ `modified_by_firstname` - No longer returned
- ❌ `modified_by_lastname` - No longer returned
- ❌ `data` - Removed from `GET /templates` list response (still included in `GET /templates/{id}`)

#### Rationale:
- **User names removed**: Only user IDs (`created_by`, `last_modified_by`) are returned. If names are needed, the client can fetch them separately from the users endpoint.
- **Data field removed from list**: The `data` field contains the full SurveyJS JSON definition which can be large. It's now excluded from list responses to improve performance and reduce payload size. It's still returned when fetching a single template via `GET /templates/{id}`.

### Updated Response Structure

#### GET /templates (List)
**Before**:
```json
{
  "templates": [
    {
      "template_id": "ABC123",
      "name": "Survey Template",
      "surveyjs_version": "1.9.0",
      "languages": ["en", "cs"],
      "data": { ...large SurveyJS JSON... },
      "created": "2026-01-03T10:00:00Z",
      "last_update": "2026-01-03T12:00:00Z",
      "created_by": "USER001",
      "created_by_firstname": "Pavel",
      "created_by_lastname": "Muzik",
      "last_modified_by": "USER001",
      "modified_by_firstname": "Pavel",
      "modified_by_lastname": "Muzik"
    }
  ]
}
```

**After**:
```json
{
  "templates": [
    {
      "template_id": "ABC123",
      "name": "Survey Template",
      "surveyjs_version": "1.9.0",
      "languages": ["en", "cs"],
      "created": "2026-01-03T10:00:00Z",
      "last_update": "2026-01-03T12:00:00Z",
      "created_by": "USER001",
      "last_modified_by": "USER001"
    }
  ]
}
```

#### GET /templates/{id} (Single)
**Before**:
```json
{
  "template_id": "ABC123",
  "name": "Survey Template",
  "surveyjs_version": "1.9.0",
  "languages": ["en", "cs"],
  "data": { ...SurveyJS JSON... },
  "created": "2026-01-03T10:00:00Z",
  "last_update": "2026-01-03T12:00:00Z",
  "created_by": "USER001",
  "created_by_firstname": "Pavel",
  "created_by_lastname": "Muzik",
  "last_modified_by": "USER001",
  "modified_by_firstname": "Pavel",
  "modified_by_lastname": "Muzik"
}
```

**After**:
```json
{
  "template_id": "ABC123",
  "name": "Survey Template",
  "surveyjs_version": "1.9.0",
  "languages": ["en", "cs"],
  "data": { ...SurveyJS JSON... },
  "created": "2026-01-03T10:00:00Z",
  "last_update": "2026-01-03T12:00:00Z",
  "created_by": "USER001",
  "last_modified_by": "USER001"
}
```

### Database Query Optimization

#### Before:
```sql
SELECT t.*, 
       u1.firstname as created_by_firstname, 
       u1.lastname as created_by_lastname,
       u2.firstname as modified_by_firstname, 
       u2.lastname as modified_by_lastname
FROM templates t
LEFT JOIN users u1 ON t.created_by = u1.user_id
LEFT JOIN users u2 ON t.last_modified_by = u2.user_id
ORDER BY t.last_update DESC
```

#### After:
```sql
SELECT template_id, name, surveyjs_version, languages, 
       created, last_update, created_by, last_modified_by
FROM templates
ORDER BY last_update DESC
```

**Performance Impact**: Removed two LEFT JOINs, significantly improving query performance for large datasets.

### OpenAPI Schema Updates

Updated schemas in `docs/openapi.yaml`:

#### TemplateListItem Schema
- Added `created` and `created_by`, `last_modified_by` fields
- Removed implicit inclusion of `data` field
- Added descriptions for `created_by` and `last_modified_by`

#### Template Schema  
- Added description noting user names are not included
- Added descriptions for `created_by` and `last_modified_by` fields

### Migration Notes

**Breaking Change**: This is a breaking change for clients expecting user name fields or the `data` field in list responses.

**Client Migration**:
1. Remove dependencies on `created_by_firstname`, `created_by_lastname`, `modified_by_firstname`, `modified_by_lastname`
2. Use `created_by` and `last_modified_by` user IDs instead
3. Fetch user details separately if needed via `/users/{id}` or `/auth/me`
4. For list views, don't expect the `data` field - fetch individual templates via `GET /templates/{id}` when needed

### Testing

After rebuild (`sam build`), the changes are live on the SAM local server at http://127.0.0.1:3000

Test with:
```bash
# List templates (no data field, no user names)
curl -H "X-Api-Token: G-Y44Oz86mWTEbNdhheB52qzBJgdaY5v7Bem3C_xmDw" \
  http://127.0.0.1:3000/templates

# Get single template (includes data field, no user names)
curl -H "X-Api-Token: G-Y44Oz86mWTEbNdhheB52qzBJgdaY5v7Bem3C_xmDw" \
  http://127.0.0.1:3000/templates/DGFVT9W6A8M6N1ZF
```

### Benefits

1. **Performance**: Removed unnecessary JOINs, faster queries
2. **Payload Size**: List responses are significantly smaller without `data` field
3. **Separation of Concerns**: User information is separated from templates data
4. **Scalability**: Better performance with large numbers of templates

### Status: ✅ Complete

All changes implemented, tested, and documented.
