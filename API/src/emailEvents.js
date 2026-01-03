'use strict';

/**
 * SES event handler (SNS -> SQS -> Lambda).
 *
 * Expected input: SQS records whose body contains an SES event JSON.
 * This worker should:
 *  - parse provider_message_id (SES MessageId)
 *  - insert raw event into email_delivery_events
 *  - update campaign_email_log.status / last_event_* based on event type
 *  - if bounce/complaint: add global blacklist entry for recipient email
 *
 * NOTE: Implementation intentionally left as a placeholder in this skeleton.
 */
exports.handler = async (event) => {
  console.log('SES events batch size:', event?.Records?.length || 0);
  return { ok: true };
};
