# Seed Example Data with proper UTF-8 encoding
# This script must be run with UTF-8 encoding support

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:Path = "C:\Program Files\MySQL\MySQL Server 8.0\bin;$env:Path"

$password = "HUIEwhmeAk9I7k7b_Wg8T"
$dbname = "evalytics_survey"

Write-Host "Creating example survey data with proper UTF-8 encoding..." -ForegroundColor Cyan

# Form version with multilingual content
$formVersionData = @'
{
  "title": {
    "default": "Employee Satisfaction Survey 2026",
    "cs": "Průzkum spokojenosti zaměstnanců 2026"
  },
  "description": {
    "default": "Your feedback helps us create a better workplace",
    "cs": "Vaše zpětná vazba nám pomůže vytvořit lepší pracovní prostředí"
  },
  "logoPosition": "right",
  "pages": [
    {
      "name": "page1",
      "title": {
        "default": "Work Environment",
        "cs": "Pracovní prostředí"
      },
      "elements": [
        {
          "type": "rating",
          "name": "overall_satisfaction",
          "title": {
            "default": "Overall, how satisfied are you with your current job?",
            "cs": "Celkově, jak jste spokojeni se svou současnou prací?"
          },
          "description": {
            "default": "Rate from 1 (very dissatisfied) to 5 (very satisfied)",
            "cs": "Ohodnoťte od 1 (velmi nespokojený) do 5 (velmi spokojený)"
          },
          "isRequired": true,
          "rateMin": 1,
          "rateMax": 5,
          "minRateDescription": {
            "default": "Very dissatisfied",
            "cs": "Velmi nespokojený"
          },
          "maxRateDescription": {
            "default": "Very satisfied",
            "cs": "Velmi spokojený"
          }
        },
        {
          "type": "checkbox",
          "name": "benefits",
          "title": {
            "default": "Which benefits are most important to you?",
            "cs": "Které benefity jsou pro vás nejdůležitější?"
          },
          "choices": [
            {
              "value": "health",
              "text": {
                "default": "Health insurance",
                "cs": "Zdravotní pojištění"
              }
            },
            {
              "value": "vacation",
              "text": {
                "default": "Extra vacation days",
                "cs": "Extra dny dovolené"
              }
            },
            {
              "value": "flexible",
              "text": {
                "default": "Flexible hours",
                "cs": "Flexibilní pracovní doba"
              }
            },
            {
              "value": "remote",
              "text": {
                "default": "Remote work",
                "cs": "Práce z domova"
              }
            }
          ]
        },
        {
          "type": "comment",
          "name": "suggestions",
          "title": {
            "default": "What suggestions do you have?",
            "cs": "Jaké máte návrhy na zlepšení?"
          },
          "rows": 4
        }
      ]
    }
  ],
  "showProgressBar": "top",
  "completedHtml": {
    "default": "<h3>Thank you!</h3>",
    "cs": "<h3>Děkujeme!</h3>"
  }
}
'@ -replace '"', '\"' -replace "`r`n", '' -replace "`n", ''

# Insert form version
$sql = "SET NAMES utf8mb4; INSERT INTO form_versions (version_id, form_id, form_name, version, version_description, surveyjs_version, languages, data, created_by, last_modified_by, created, last_update) VALUES ('v1h2i3j4k5l6m7n8', 'f1a2b3c4d5e6f7g8', 'Průzkum spokojenosti zaměstnanců', 1, 'Q1 2026', '1.12.0', '[\"en\", \"cs\"]', '$formVersionData', 'ADMIN001', 'ADMIN001', NOW(), NOW());"

mysql -u vcagent -p"$password" $dbname --default-character-set=utf8mb4 -e $sql 2>&1 | Select-String -NotMatch "Warning"

# Insert campaign
$sql = "SET NAMES utf8mb4; INSERT INTO campaigns (campaign_id, public_id, title, description, version_id, open_on, close_on, is_public, allow_multiple_responses, max_attempts, created_by, last_modified_by, created, last_update) VALUES ('c1o2p3q4r5s6t7u8', 'zamestnanecky-pruzkum-2026', '{\"en\": \"Employee Survey 2026\", \"cs\": \"Zaměstnanecký průzkum 2026\"}', '{\"en\": \"Help us improve\", \"cs\": \"Pomozte nám zlepšit se\"}', 'v1h2i3j4k5l6m7n8', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 0, 0, NULL, 'ADMIN001', 'ADMIN001', NOW(), NOW());"

mysql -u vcagent -p"$password" $dbname --default-character-set=utf8mb4 -e $sql 2>&1 | Select-String -NotMatch "Warning"

# Insert respondents
$sql = @"
SET NAMES utf8mb4;
INSERT INTO campaign_respondents (respondent_id, campaign_id, email, email_hash, data, token_hash, created, last_update) VALUES
('r1v2w3x4y5z6a7b8', 'c1o2p3q4r5s6t7u8', 'jan.novak@company.cz', SHA2('jan.novak@company.cz', 256), '{\"name\": \"Jan Novák\", \"department\": \"IT\", \"token\": \"t1xa2yb3zc4wd5ee\"}', SHA2('t1xa2yb3zc4wd5ee', 256), NOW(), NOW()),
('r2c3d4e5f6g7h8i9', 'c1o2p3q4r5s6t7u8', 'marie.svobodova@company.cz', SHA2('marie.svobodova@company.cz', 256), '{\"name\": \"Marie Svobodová\", \"department\": \"Marketing\", \"token\": \"t2gb3hc4id5je6kf\"}', SHA2('t2gb3hc4id5je6kf', 256), NOW(), NOW()),
('r3j4k5l6m7n8o9p0', 'c1o2p3q4r5s6t7u8', 'petr.dvorak@company.cz', SHA2('petr.dvorak@company.cz', 256), '{\"name\": \"Petr Dvořák\", \"department\": \"Prodej\", \"token\": \"t3mc4nd5oe6pf7qg\"}', SHA2('t3mc4nd5oe6pf7qg', 256), NOW(), NOW());
"@

mysql -u vcagent -p"$password" $dbname --default-character-set=utf8mb4 -e $sql 2>&1 | Select-String -NotMatch "Warning"

Write-Host "`n✅ Example data created successfully!" -ForegroundColor Green
Write-Host "`nSurvey URLs:" -ForegroundColor Yellow
Write-Host "  Jan Novák:    http://localhost:5174/survey/zamestnanecky-pruzkum-2026?token=t1xa2yb3zc4wd5ee"
Write-Host "  Marie Svobodová: http://localhost:5174/survey/zamestnanecky-pruzkum-2026?token=t2gb3hc4id5je6kf"
Write-Host "  Petr Dvořák:  http://localhost:5174/survey/zamestnanecky-pruzkum-2026?token=t3mc4nd5oe6pf7qg"
