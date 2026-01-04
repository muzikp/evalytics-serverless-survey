-- Generate new campaign with respondents
-- Usage: Update variables below and run this script

-- CONFIGURATION - UPDATE THESE VALUES
SET @campaign_id = 'campaign_002';  -- Unique campaign ID
SET @public_id = 'employee-feedback-2026';  -- Public URL identifier
SET @title = 'Employee Feedback Survey 2026';
SET @description = 'Quarterly employee engagement and feedback survey';
SET @email_template = '<html><body><h1>Hi {{name}}!</h1><p>We value your feedback! Please take a few minutes to complete our Employee Feedback Survey.</p><p><a href="{{link}}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Start Survey</a></p><p>Your responses are confidential.</p><p>Thank you!</p></body></html>';
SET @open_on = '2026-01-15 00:00:00';  -- When survey opens (NULL for immediate)
SET @close_on = '2026-03-31 23:59:59';  -- When survey closes (NULL for no deadline)
SET @is_public = 0;  -- 0 = private (invite only), 1 = public
SET @allow_retries = 1;  -- 0 = one attempt only, 1 = multiple attempts allowed
SET @allow_multiple_responses = 0;  -- 0 = one response per respondent, 1 = multiple responses

-- AUTO-FILLED VALUES
SET @user_id = (SELECT user_id FROM users LIMIT 1);
SET @form_version_id = (SELECT version_id FROM form_versions LIMIT 1);  -- Or specify: (SELECT version_id FROM form_versions WHERE form_id = 'your_form_id' ORDER BY version DESC LIMIT 1)
SET @now = NOW();

-- Insert campaign
INSERT INTO campaigns (
    campaign_id, 
    version_id, 
    public_id, 
    title, 
    description, 
    email_template, 
    open_on, 
    close_on, 
    is_public, 
    allow_retries, 
    allow_multiple_responses,
    created, 
    last_update, 
    created_by, 
    last_modified_by
)
VALUES (
    @campaign_id,
    @form_version_id,
    @public_id,
    JSON_QUOTE(@title),
    JSON_QUOTE(@description),
    JSON_QUOTE(@email_template),
    @open_on,
    @close_on,
    @is_public,
    @allow_retries,
    @allow_multiple_responses,
    @now,
    @now,
    @user_id,
    @user_id
);

-- Insert respondents (update email addresses and custom data as needed)
INSERT INTO campaign_respondents (respondent_id, campaign_id, email, email_hash, token_hash, data, created, last_update)
VALUES 
-- Respondent 1
(
    CONCAT('resp_', UUID_SHORT()), 
    @campaign_id, 
    'employee1@company.com',
    SHA2('employee1@company.com', 256),
    SHA2(CONCAT('token_', UUID()), 256),
    '{"department": "Engineering", "position": "Developer", "team": "Backend"}',
    @now,
    @now
),
-- Respondent 2
(
    CONCAT('resp_', UUID_SHORT()), 
    @campaign_id, 
    'employee2@company.com',
    SHA2('employee2@company.com', 256),
    SHA2(CONCAT('token_', UUID()), 256),
    '{"department": "Marketing", "position": "Manager", "team": "Digital"}',
    @now,
    @now
),
-- Respondent 3
(
    CONCAT('resp_', UUID_SHORT()), 
    @campaign_id, 
    'employee3@company.com',
    SHA2('employee3@company.com', 256),
    SHA2(CONCAT('token_', UUID()), 256),
    '{"department": "Sales", "position": "Representative", "team": "Enterprise"}',
    @now,
    @now
),
-- Respondent 4
(
    CONCAT('resp_', UUID_SHORT()), 
    @campaign_id, 
    'employee4@company.com',
    SHA2('employee4@company.com', 256),
    SHA2(CONCAT('token_', UUID()), 256),
    '{"department": "HR", "position": "Specialist", "team": "Recruitment"}',
    @now,
    @now
),
-- Respondent 5
(
    CONCAT('resp_', UUID_SHORT()), 
    @campaign_id, 
    'employee5@company.com',
    SHA2('employee5@company.com', 256),
    SHA2(CONCAT('token_', UUID()), 256),
    '{"department": "Product", "position": "Lead", "team": "Innovation"}',
    @now,
    @now
);

-- Verification queries
SELECT 'Campaign created:' as status, campaign_id, title, public_id FROM campaigns WHERE campaign_id = @campaign_id;
SELECT 'Respondents created:' as status, COUNT(*) as count FROM campaign_respondents WHERE campaign_id = @campaign_id;
SELECT * FROM campaign_respondents WHERE campaign_id = @campaign_id ORDER BY email;
