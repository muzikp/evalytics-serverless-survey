/**
 * SES Event Handler (SNS -> SQS -> Lambda)
 * 
 * Processes delivery events from AWS SES:
 * - Delivery confirmations
 * - Bounces (hard/soft)
 * - Complaints (spam reports)
 * - Opens/Clicks (if configured)
 * 
 * Updates campaign_email_log and adds bounces/complaints to blacklist
 */

import { query, queryOne } from './db.js';
import { formatDateTime } from './utils.js';

export async function handler(event) {
  console.log('SES events batch size:', event?.Records?.length || 0);
  
  const results = {
    processed: 0,
    failed: 0,
    errors: []
  };
  
  for (const record of event.Records || []) {
    try {
      // Parse SES event from SQS message
      const sesMessage = JSON.parse(record.body);
      const eventType = sesMessage.eventType || sesMessage.notificationType;
      
      console.log('Processing SES event:', eventType);
      
      // Extract common fields
      const mail = sesMessage.mail || {};
      const messageId = mail.messageId;
      const timestamp = sesMessage.timestamp || mail.timestamp;
      
      if (!messageId) {
        console.warn('SES event missing messageId, skipping');
        results.failed++;
        continue;
      }
      
      // Store raw event
      await storeRawEvent(messageId, eventType, timestamp, sesMessage);
      
      // Process based on event type
      switch (eventType) {
        case 'Delivery':
          await handleDelivery(messageId, sesMessage);
          break;
        
        case 'Bounce':
          await handleBounce(messageId, sesMessage);
          break;
        
        case 'Complaint':
          await handleComplaint(messageId, sesMessage);
          break;
        
        case 'Send':
          await handleSend(messageId, sesMessage);
          break;
        
        default:
          console.log(`Unhandled event type: ${eventType}`);
      }
      
      results.processed++;
      
    } catch (error) {
      console.error('Error processing SES event:', error);
      results.failed++;
      results.errors.push({
        record: record.body?.substring(0, 200),
        error: error.message
      });
    }
  }
  
  console.log('SES event processing complete:', results);
  return results;
}

/**
 * Store raw SES event for audit
 */
async function storeRawEvent(messageId, eventType, timestamp, payload) {
  const eventAt = timestamp ? new Date(timestamp).toISOString().slice(0, 19).replace('T', ' ') : formatDateTime();
  
  await query(
    `INSERT INTO email_delivery_events 
     (provider, provider_message_id, event_type, event_at, payload_json)
     VALUES ('ses', ?, ?, ?, ?)`,
    [messageId, eventType, eventAt, JSON.stringify(payload)]
  );
}

/**
 * Handle successful delivery
 */
async function handleDelivery(messageId, event) {
  const delivery = event.delivery || {};
  const recipients = delivery.recipients || [];
  const timestamp = event.timestamp || delivery.timestamp;
  const eventAt = timestamp ? new Date(timestamp).toISOString().slice(0, 19).replace('T', ' ') : formatDateTime();
  
  // Update email log
  await query(
    `UPDATE campaign_email_log 
     SET status = 'delivered', 
         last_event_type = 'Delivery',
         last_event_at = ?,
         last_update = ?
     WHERE provider_message_id = ?`,
    [eventAt, formatDateTime(), messageId]
  );
  
  console.log(`Delivery confirmed for messageId: ${messageId}`);
}

/**
 * Handle bounce (permanent or temporary delivery failure)
 */
async function handleBounce(messageId, event) {
  const bounce = event.bounce || {};
  const bounceType = bounce.bounceType; // 'Permanent' or 'Transient'
  const recipients = bounce.bouncedRecipients || [];
  const timestamp = event.timestamp || bounce.timestamp;
  const eventAt = timestamp ? new Date(timestamp).toISOString().slice(0, 19).replace('T', ' ') : formatDateTime();
  
  // Update email log
  await query(
    `UPDATE campaign_email_log 
     SET status = 'bounced', 
         last_event_type = ?,
         last_event_at = ?,
         error_message = ?,
         last_update = ?
     WHERE provider_message_id = ?`,
    [
      `Bounce:${bounceType}`,
      eventAt,
      bounce.bounceSubType || bounceType,
      formatDateTime(),
      messageId
    ]
  );
  
  // For permanent bounces, add to blacklist
  if (bounceType === 'Permanent') {
    for (const recipient of recipients) {
      const email = recipient.emailAddress;
      if (!email) continue;
      
      console.log(`Adding ${email} to blacklist (permanent bounce)`);
      
      try {
        await query(
          `INSERT INTO email_blacklist 
           (email, scope, unsubscribe_all, reason, blacklisted_at, blacklisted_by)
           VALUES (?, 'global', 1, ?, ?, 'system')
           ON DUPLICATE KEY UPDATE 
             reason = VALUES(reason),
             blacklisted_at = VALUES(blacklisted_at)`,
          [
            email,
            `Permanent bounce: ${bounce.bounceSubType || 'Unknown'}`,
            formatDateTime()
          ]
        );
      } catch (error) {
        console.error(`Failed to blacklist ${email}:`, error);
      }
    }
  }
  
  console.log(`Bounce processed for messageId: ${messageId}, type: ${bounceType}`);
}

/**
 * Handle complaint (spam report)
 */
async function handleComplaint(messageId, event) {
  const complaint = event.complaint || {};
  const recipients = complaint.complainedRecipients || [];
  const timestamp = event.timestamp || complaint.timestamp;
  const eventAt = timestamp ? new Date(timestamp).toISOString().slice(0, 19).replace('T', ' ') : formatDateTime();
  
  // Update email log
  await query(
    `UPDATE campaign_email_log 
     SET status = 'complaint', 
         last_event_type = 'Complaint',
         last_event_at = ?,
         error_message = ?,
         last_update = ?
     WHERE provider_message_id = ?`,
    [
      eventAt,
      complaint.complaintFeedbackType || 'Spam complaint',
      formatDateTime(),
      messageId
    ]
  );
  
  // Add complainants to global blacklist
  for (const recipient of recipients) {
    const email = recipient.emailAddress;
    if (!email) continue;
    
    console.log(`Adding ${email} to blacklist (complaint)`);
    
    try {
      await query(
        `INSERT INTO email_blacklist 
         (email, scope, unsubscribe_all, reason, blacklisted_at, blacklisted_by)
         VALUES (?, 'global', 1, ?, ?, 'system')
         ON DUPLICATE KEY UPDATE 
           reason = VALUES(reason),
           blacklisted_at = VALUES(blacklisted_at)`,
        [
          email,
          `Spam complaint: ${complaint.complaintFeedbackType || 'User reported spam'}`,
          formatDateTime()
        ]
      );
    } catch (error) {
      console.error(`Failed to blacklist ${email}:`, error);
    }
  }
  
  console.log(`Complaint processed for messageId: ${messageId}`);
}

/**
 * Handle send event (email accepted by SES)
 */
async function handleSend(messageId, event) {
  const mail = event.mail || {};
  const timestamp = event.timestamp || mail.timestamp;
  const eventAt = timestamp ? new Date(timestamp).toISOString().slice(0, 19).replace('T', ' ') : formatDateTime();
  
  // Optional: update log if you want to track "sent" separately from "queued"
  await query(
    `UPDATE campaign_email_log 
     SET last_event_type = 'Send',
         last_event_at = ?
     WHERE provider_message_id = ?`,
    [eventAt, messageId]
  );
  
  console.log(`Send event recorded for messageId: ${messageId}`);
}
