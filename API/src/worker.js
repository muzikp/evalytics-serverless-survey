/**
 * Email Worker Lambda
 * 
 * Processes SQS messages and sends emails via AWS SES
 * Logs results to campaign_email_log
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { query } from './db.js';
import { formatDateTime } from './utils.js';

const ses = new SESClient({ region: process.env.AWS_REGION || 'eu-central-1' });

export async function handler(event) {
  console.log('Email worker processing batch:', event.Records?.length || 0);
  
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };
  
  for (const record of event.Records || []) {
    try {
      const message = JSON.parse(record.body);
      const {
        campaign_id,
        respondent_id,
        recipient_email,
        email_type,
        subject,
        html_body,
        from_email
      } = message;
      
      console.log(`Sending ${email_type} email to ${recipient_email}...`);
      
      // Send email via SES
      const command = new SendEmailCommand({
        Source: from_email,
        Destination: {
          ToAddresses: [recipient_email]
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: html_body,
              Charset: 'UTF-8'
            }
          }
        }
      });
      
      const response = await ses.send(command);
      const messageId = response.MessageId;
      
      console.log(`Email sent successfully. MessageId: ${messageId}`);
      
      // Log to database
      const now = formatDateTime();
      await query(
        `INSERT INTO campaign_email_log 
         (campaign_id, respondent_id, recipient_email, email_type, provider, provider_message_id, status, created, last_update)
         VALUES (?, ?, ?, ?, 'ses', ?, 'sent', ?, ?)`,
        [campaign_id, respondent_id, recipient_email, email_type, messageId, now, now]
      );
      
      // Update campaign_respondents with invitation timestamp
      if (email_type === 'invite') {
        await query(
          'UPDATE campaign_respondents SET invitation_sent_at = ?, invitation_error = NULL WHERE respondent_id = ?',
          [now, respondent_id]
        );
      }
      
      results.success++;
      
    } catch (error) {
      console.error('Error sending email:', error);
      results.failed++;
      results.errors.push({
        message: record.body,
        error: error.message
      });
      
      // Try to log error to database
      try {
        const message = JSON.parse(record.body);
        const now = formatDateTime();
        
        await query(
          `INSERT INTO campaign_email_log 
           (campaign_id, respondent_id, recipient_email, email_type, provider, status, error_message, created, last_update)
           VALUES (?, ?, ?, ?, 'ses', 'failed', ?, ?, ?)`,
          [
            message.campaign_id,
            message.respondent_id,
            message.recipient_email,
            message.email_type,
            error.message,
            now,
            now
          ]
        );
        
        // Update respondent with error
        if (message.email_type === 'invite') {
          await query(
            'UPDATE campaign_respondents SET invitation_error = ? WHERE respondent_id = ?',
            [error.message, message.respondent_id]
          );
        }
      } catch (logError) {
        console.error('Failed to log error to database:', logError);
      }
    }
  }
  
  console.log('Email batch processing complete:', results);
  return results;
}
