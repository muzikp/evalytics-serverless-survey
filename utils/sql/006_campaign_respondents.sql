-- Add public and allow_retries columns to campaigns table
ALTER TABLE campaigns 
ADD COLUMN is_public TINYINT(1) DEFAULT 0 AFTER version_id,
ADD COLUMN allow_retries TINYINT(1) DEFAULT 1 AFTER is_public;

-- Create campaign_respondents table
CREATE TABLE IF NOT EXISTS campaign_respondents (
    respondent_id VARCHAR(20) PRIMARY KEY,
    campaign_id VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    custom_data JSON,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_campaign (campaign_id),
    INDEX idx_email (email),
    INDEX idx_token (token),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create email blacklist table
CREATE TABLE IF NOT EXISTS email_blacklist (
    email VARCHAR(255) PRIMARY KEY,
    reason VARCHAR(255),
    blacklisted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    blacklisted_by VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
