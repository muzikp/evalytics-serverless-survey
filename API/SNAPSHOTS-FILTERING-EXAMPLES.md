# Snapshots API Filtering Examples

## Overview
The GET /snapshots endpoint now supports comprehensive filtering through query parameters, similar to templates.

## Available Filter Parameters

| Parameter          | Type     | Description                                    | Example                              |
| ------------------ | -------- | ---------------------------------------------- | ------------------------------------ |
| `id`               | string   | Exact snapshot_id match                        | `?id=SNP001`                         |
| `template_id`      | string   | Filter by source template                      | `?template_id=TPL001`                |
| `version`          | integer  | Exact version number                           | `?version=3`                         |
| `locked`           | boolean  | Filter by locked status                        | `?locked=true`                       |
| `surveyjs_version` | string   | Exact SurveyJS version                         | `?surveyjs_version=1.9.116`          |
| `languages`        | string   | Filter snapshots containing this language code | `?languages=cs`                      |
| `created_by`       | string   | User ID who created the snapshot               | `?created_by=ADMIN001`               |
| `last_modified_by` | string   | User ID who last modified                      | `?last_modified_by=ADMIN001`         |
| `created_from`     | datetime | Created on or after this timestamp             | `?created_from=2026-01-01T00:00:00Z` |
| `created_to`       | datetime | Created on or before this timestamp            | `?created_to=2026-12-31T23:59:59Z`   |
| `updated_from`     | datetime | Last updated on or after                       | `?updated_from=2026-01-01T00:00:00Z` |
| `updated_to`       | datetime | Last updated on or before                      | `?updated_to=2026-12-31T23:59:59Z`   |

## Key Differences from Templates

### Data Field Excluded from List
Like templates, snapshots list **does NOT include the `data` field** to improve performance:
- GET /snapshots returns snapshots without the full SurveyJS configuration data
- Use GET /snapshots/{id} to retrieve a specific snapshot with full data
- This reduces payload size and improves list query performance
- Snapshots metadata (version, languages, locked status, etc.) is sufficient for listing

### User Name Fields Removed
Like templates, snapshots responses no longer include:
- `created_by_firstname`, `created_by_lastname`
- `modified_by_firstname`, `modified_by_lastname`

Only user IDs are returned: `created_by`, `last_modified_by`

## Usage Examples

### 1. Filter by Template
```bash
GET /snapshots?template_id=TPL001
```
Returns all snapshots created from template TPL001.

### 2. Filter by Version Number
```bash
GET /snapshots?template_id=TPL001&version=3
```
Returns version 3 of template TPL001 (if exists).

### 3. Filter by Locked Status
```bash
GET /snapshots?locked=true
```
Returns all locked (immutable) snapshots.

### 4. Filter by Language Support
```bash
GET /snapshots?languages=cs
```
Returns all snapshots that support Czech language.

### 5. Filter by SurveyJS Version
```bash
GET /snapshots?surveyjs_version=1.9.116
```
Returns all snapshots using SurveyJS version 1.9.116.

### 6. Find Latest Snapshots
```bash
GET /snapshots?created_from=2026-01-01T00:00:00Z&limit=10
```
Returns the 10 most recent snapshots created since January 1, 2026.

### 7. Complex Multi-Criteria Filter
```bash
GET /snapshots?template_id=TPL001&locked=true&languages=en&created_from=2026-01-01T00:00:00Z
```
Returns locked English snapshots of TPL001 created in 2026.

## PowerShell Examples

### Filter by template and version
```powershell
$headers = @{ 'X-Api-Token' = 'YOUR_API_TOKEN' }
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/snapshots?template_id=TPL001&version=3' -Headers $headers
```

### Find unlocked snapshots (editable)
```powershell
$headers = @{ 'X-Api-Token' = 'YOUR_API_TOKEN' }
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/snapshots?locked=false' -Headers $headers
```

### Filter by language and date range
```powershell
$headers = @{ 'X-Api-Token' = 'YOUR_API_TOKEN' }
$params = @{
    languages = 'cs'
    created_from = '2026-01-01T00:00:00Z'
    created_to = '2026-01-31T23:59:59Z'
}
$query = ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join '&'
Invoke-RestMethod -Uri "http://127.0.0.1:3000/snapshots?$query" -Headers $headers
```

### Find specific snapshot by ID
```powershell
$headers = @{ 'X-Api-Token' = 'YOUR_API_TOKEN' }
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/snapshots?id=SNP001' -Headers $headers
```

## Version Management Examples

### Get all versions of a template
```bash
GET /snapshots?template_id=TPL001
```
Returns all snapshot versions of template TPL001, ordered by creation date (newest first).

### Get latest version of each template
This requires client-side processing after fetching all snapshots, or use direct queries:
```bash
# Get snapshots created in the last 24 hours (likely the newest)
GET /snapshots?created_from=2026-01-02T00:00:00Z&limit=50
```

### Find specific version across all templates
```bash
GET /snapshots?version=1
```
Returns version 1 of all templates.

## Locked Snapshots

Snapshots are typically locked (`locked=true`) to prevent modifications once they're used in campaigns:

### Find modifiable snapshots
```bash
GET /snapshots?locked=false
```

### Find locked snapshots for a template
```bash
GET /snapshots?template_id=TPL001&locked=true
```

## Date Filtering Best Practices

### Find snapshots created today
```bash
GET /snapshots?created_from=2026-01-03T00:00:00Z&created_to=2026-01-03T23:59:59Z
```

### Find snapshots modified this month
```bash
GET /snapshots?updated_from=2026-01-01T00:00:00Z&updated_to=2026-01-31T23:59:59Z
```

### Find snapshots created before a specific date
```bash
GET /snapshots?created_to=2025-12-31T23:59:59Z
```

## Implementation Details

### SQL Query Construction
All filter parameters are combined with AND logic:
```sql
SELECT s.snapshot_id, s.template_id, s.version, s.surveyjs_version, s.surveyjs_template,
       s.languages, s.data, s.note, s.locked, s.created, s.last_update, s.created_by, s.last_modified_by,
       t.name as template_name
FROM snapshots s
LEFT JOIN templates t ON s.template_id = t.template_id
WHERE s.template_id = 'TPL001'
  AND s.locked = 1
  AND JSON_CONTAINS(s.languages, '"cs"', '$')
  AND s.created >= '2026-01-01 00:00:00'
ORDER BY s.created DESC
LIMIT 50 OFFSET 0
```

### Language Filtering
Uses MySQL's JSON_CONTAINS function:
- Efficient with MySQL 8.0 JSON support
- Case-sensitive match on language code
- Use standard ISO 639-1 codes: "en", "cs", "de", etc.

### Boolean Parameters
The `locked` parameter accepts:
- `true`, `1` → locked snapshots
- `false`, `0` → unlocked snapshots

### Performance Optimization
- Removed LEFT JOINs to users table (no longer fetching user names)
- Direct column selection instead of SELECT *
- Only template name is JOINed (lightweight)
- All date/boolean/ID filters use indexed columns

## Response Structure

### List Response
```json
{
  "items": [
    {
      "snapshot_id": "SNP001",
      "template_id": "TPL001",
      "template_name": "Customer Satisfaction Survey",
      "version": 3,
      "surveyjs_version": "1.9.116",
      "surveyjs_template": "modern",
      "languages": ["en", "cs"],
      "note": "Added Czech translation",
      "locked": true,
      "created": "2026-01-03T10:30:00Z",
      "last_update": "2026-01-03T10:30:00Z",
      "created_by": "ADMIN001",
      "last_modified_by": "ADMIN001"
    }
  ],
  "page": {
    "limit": 50,
    "offset": 0,
    "total": 15
  }
}
```

### Single Snapshot Response (GET /snapshots/{id})
Same structure as list items, but **includes the full `data` field** with SurveyJS configuration.

## Comparison with Templates API

| Feature              | Templates   | Snapshots                     |
| -------------------- | ----------- | ----------------------------- |
| Data field in list   | ❌ Excluded  | ❌ Excluded                    |
| Data field in detail | ✅ Included  | ✅ Included                    |
| User name fields     | ❌ Removed   | ❌ Removed                     |
| User ID fields       | ✅ Included  | ✅ Included                    |
| Version filtering    | ❌ N/A       | ✅ Supported                   |
| Locked filtering     | ❌ N/A       | ✅ Supported                   |
| Language filtering   | ✅ Supported | ✅ Supported                   |
| Date range filtering | ✅ Supported | ✅ Supported                   |
| Template reference   | ❌ N/A       | ✅ template_id + template_name |

## Testing Recommendations

1. **Test filtering with no results**: Verify empty array is returned
2. **Test combined filters**: Ensure AND logic works correctly
3. **Test invalid values**: Check error handling for invalid dates, booleans
4. **Test pagination with filters**: Ensure count reflects filtered results
5. **Test performance**: Compare query times with/without filters
