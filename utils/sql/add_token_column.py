#!/usr/bin/env python3
"""
Add token column to campaign_respondents table
"""
import os
import sys
import pymysql
from dotenv import load_dotenv

# Load .env from project root
project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
env_path = os.path.join(project_root, '.env')
load_dotenv(env_path)

def main():
    # Database connection
    connection = pymysql.connect(
        host=os.getenv('MYSQL_HOST', 'localhost'),
        port=int(os.getenv('MYSQL_PORT', 3306)),
        user=os.getenv('MYSQL_USER', 'root'),
        password=os.getenv('MYSQL_PASSWORD', 'root'),
        database=os.getenv('MYSQL_DATABASE', 'evalytics_survey'),
        charset='utf8mb4'
    )
    
    try:
        with connection.cursor() as cursor:
            # Check if column exists
            cursor.execute("""
                SELECT COUNT(*) FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = %s 
                AND TABLE_NAME = 'campaign_respondents' 
                AND COLUMN_NAME = 'token'
            """, (os.getenv('MYSQL_DATABASE', 'evalytics_survey'),))
            
            exists = cursor.fetchone()[0]
            
            if exists:
                print("✓ Column 'token' already exists")
            else:
                print("Adding 'token' column...")
                cursor.execute("""
                    ALTER TABLE campaign_respondents 
                    ADD COLUMN token VARCHAR(64) NULL 
                    COMMENT 'Plaintext token for private campaign URLs' 
                    AFTER email
                """)
                connection.commit()
                print("✓ Column 'token' added successfully")
                
    finally:
        connection.close()

if __name__ == '__main__':
    main()
