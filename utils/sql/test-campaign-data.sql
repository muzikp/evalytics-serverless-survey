-- Create test campaign with respondents
-- Run this after you have at least one form and form_version

-- Get first available user_id and form_version_id
SET @user_id = (SELECT user_id FROM users LIMIT 1);
SET @form_version_id = (SELECT version_id FROM form_versions LIMIT 1);
SET @campaign_id = 'test_campaign_01';
SET @now = NOW();
SET @email_template = '<html><body><h1>Hello {{name}}!</h1><p>You are invited to complete our Customer Satisfaction Survey 2026.</p><p><a href="{{link}}">Click here to start</a></p><p>Thank you!</p></body></html>';

-- Insert test campaign
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
    'customer-satisfaction-2026',
    '"Customer Satisfaction Survey 2026"',
    '"Annual survey to measure customer satisfaction and feedback"',
    JSON_QUOTE(@email_template),
    '2026-01-01 00:00:00',
    '2026-12-31 23:59:59',
    0,
    1,
    0,
    @now,
    @now,
    @user_id,
    @user_id
);

-- Insert 5 test respondents
INSERT INTO campaign_respondents (respondent_id, campaign_id, email, email_hash, token_hash, data, created, last_update)
VALUES 
(
    'resp_001', 
    @campaign_id, 
    'john.doe@example.com',
    SHA2('john.doe@example.com', 256),
    SHA2('token_abc123xyz789', 256),
    '{"company": "Acme Corp", "department": "Sales", "position": "Manager"}',
    @now,
    @now
),
(
    'resp_002', 
    @campaign_id, 
    'jane.smith@example.com',
    SHA2('jane.smith@example.com', 256),
    SHA2('token_def456uvw012', 256),
    '{"company": "TechStart Inc", "department": "Engineering", "position": "Developer"}',
    @now,
    @now
),
(
    'resp_003', 
    @campaign_id, 
    'bob.wilson@example.com',
    SHA2('bob.wilson@example.com', 256),
    SHA2('token_ghi789rst345', 256),
    '{"company": "Global Solutions", "department": "Marketing", "position": "Director"}',
    @now,
    @now
),
(
    'resp_004', 
    @campaign_id, 
    'alice.johnson@example.com',
    SHA2('alice.johnson@example.com', 256),
    SHA2('token_jkl012qpo678', 256),
    '{"company": "StartupHub", "department": "Product", "position": "Lead"}',
    @now,
    @now
),
(
    'resp_005', 
    @campaign_id, 
    'charlie.brown@example.com',
    SHA2('charlie.brown@example.com', 256),
    SHA2('token_mno345xyz901', 256), 
    '{"company": "Enterprise Co", "department": "Operations", "position": "Analyst"}',
    @now,
    @now
);

-- Verify
SELECT 'Campaign created:' as status, campaign_id, title, public_id FROM campaigns WHERE campaign_id = @campaign_id;
SELECT 'Respondents created:' as status, COUNT(*) as count FROM campaign_respondents WHERE campaign_id = @campaign_id;
SELECT * FROM campaign_respondents WHERE campaign_id = @campaign_id;
