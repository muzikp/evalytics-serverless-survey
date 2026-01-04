# Templates API Filtering Examples

## Overview
The GET /templates endpoint now supports comprehensive filtering through query parameters.

## Available Filter Parameters

| Parameter          | Type     | Description                                    | Example                              |
| ------------------ | -------- | ---------------------------------------------- | ------------------------------------ |
| `id`               | string   | Exact template_id match                        | `?id=TPL001`                         |
| `q`                | string   | Name substring search (case-insensitive)       | `?q=customer`                        |
| `surveyjs_version` | string   | Exact SurveyJS version                         | `?surveyjs_version=1.9.116`          |
| `languages`        | string   | Filter templates containing this language code | `?languages=cs`                      |
| `created_by`       | string   | User ID who created the template               | `?created_by=ADMIN001`               |
| `last_modified_by` | string   | User ID who last modified                      | `?last_modified_by=ADMIN001`         |
| `created_from`     | datetime | Created on or after this timestamp             | `?created_from=2026-01-01T00:00:00Z` |
| `created_to`       | datetime | Created on or before this timestamp            | `?created_to=2026-12-31T23:59:59Z`   |
| `updated_from`     | datetime | Last updated on or after                       | `?updated_from=2026-01-01T00:00:00Z` |
| `updated_to`       | datetime | Last updated on or before                      | `?updated_to=2026-12-31T23:59:59Z`   |

## Usage Examples

### 1. Basic Search by Name
```bash
GET /templates?q=customer
```
Returns all templates with "customer" in the name.

### 2. Filter by Specific Template ID
```bash
GET /templates?id=TPL001
```
Returns the template with exact ID TPL001 (useful for existence checks).

### 3. Filter by SurveyJS Version
```bash
GET /templates?surveyjs_version=1.9.116
```
Returns all templates using SurveyJS version 1.9.116.

### 4. Filter by Language Support
```bash
GET /templates?languages=cs
```
Returns all templates that support Czech language.

### 5. Filter by Creator
```bash
GET /templates?created_by=ADMIN001
```
Returns all templates created by user ADMIN001.

### 6. Filter by Date Range (Created)
```bash
GET /templates?created_from=2026-01-01T00:00:00Z&created_to=2026-01-31T23:59:59Z
```
Returns templates created in January 2026.

### 7. Filter Recently Updated Templates
```bash
GET /templates?updated_from=2026-01-01T00:00:00Z
```
Returns templates updated on or after January 1, 2026.

### 8. Combined Filters
```bash
GET /templates?q=feedback&languages=en&created_by=ADMIN001&updated_from=2026-01-01T00:00:00Z
```
Returns templates matching ALL criteria:
- Name contains "feedback"
- Supports English
- Created by ADMIN001
- Updated on or after January 1, 2026

## PowerShell Examples

### Search by name
```powershell
$headers = @{ 'X-Api-Token' = 'YOUR_API_TOKEN' }
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/templates?q=customer' -Headers $headers
```

### Filter by language and date
```powershell
$headers = @{ 'X-Api-Token' = 'YOUR_API_TOKEN' }
$params = @{
    languages = 'cs'
    created_from = '2026-01-01T00:00:00Z'
}
$query = ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join '&'
Invoke-RestMethod -Uri "http://127.0.0.1:3000/templates?$query" -Headers $headers
```

### Complex multi-criteria filter
```powershell
$headers = @{ 'X-Api-Token' = 'YOUR_API_TOKEN' }
$uri = 'http://127.0.0.1:3000/templates?' + 
       'q=satisfaction&' +
       'surveyjs_version=1.9.116&' +
       'languages=en&' +
       'created_by=ADMIN001&' +
       'updated_from=2026-01-01T00:00:00Z'
Invoke-RestMethod -Uri $uri -Headers $headers
```

## Notes on Date Filtering

### Date Format
- Use ISO 8601 format: `YYYY-MM-DDTHH:mm:ssZ`
- MySQL comparison is done directly on TIMESTAMP columns
- URL encode the datetime string if needed (though most HTTP clients handle this automatically)

### Examples
- Exact day: `created_from=2026-01-03T00:00:00Z&created_to=2026-01-03T23:59:59Z`
- This month: `created_from=2026-01-01T00:00:00Z&created_to=2026-01-31T23:59:59Z`
- Last 7 days: `updated_from=2026-12-27T00:00:00Z` (calculate 7 days ago)
- Before date: `created_to=2025-12-31T23:59:59Z`
- After date: `updated_from=2026-01-01T00:00:00Z`

## Implementation Details

### SQL Query Construction
All filter parameters are combined with AND logic:
```sql
SELECT template_id, name, surveyjs_version, languages, created, last_update, created_by, last_modified_by
FROM templates
WHERE name LIKE '%customer%'
  AND languages LIKE '%"cs"%'
  AND created >= '2026-01-01 00:00:00'
  AND last_update >= '2026-01-01 00:00:00'
ORDER BY last_update DESC
```

### Language Filtering
The `languages` parameter uses MySQL's JSON_CONTAINS function to check if the JSON array contains the specified language code.
- Efficient with MySQL 8.0 JSON support
- Case-sensitive match on language code
- Use standard ISO 639-1 codes: "en", "cs", "de", etc.

### Performance
- All filters use indexed columns or efficient MySQL functions
- Date comparisons use direct TIMESTAMP comparison
- Name search uses LIKE with wildcards (consider FULLTEXT index for large datasets)
- Multiple filters are combined efficiently with AND clauses
