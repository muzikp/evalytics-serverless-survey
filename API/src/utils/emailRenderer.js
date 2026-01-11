/**
 * Email Template Renderer
 * 
 * Handles:
 * - Placeholder replacement (__field__, __link__, __email__)
 * - Multilingual template selection
 * - Unsubscribe footer injection
 * - HTML escaping for security
 */

import crypto from 'crypto';
import { generateToken } from '../utils.js';

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate survey link with token
 */
function generateSurveyLink(publicId, token, baseUrl) {
  return `${baseUrl}/survey/${publicId}?token=${token}`;
}

/**
 * Get unsubscribe footer HTML (multilingual)
 */
function getUnsubscribeFooter(unsubscribeToken, language, apiBaseUrl) {
  const campaignUrl = `${apiBaseUrl}/unsubscribe/${unsubscribeToken}?scope=campaign`;
  const globalUrl = `${apiBaseUrl}/unsubscribe/${unsubscribeToken}?scope=global`;
  
  const translations = {
    cs: {
      campaign: 'Pokud již nechcete dostávat upozornění o tomto průzkumu',
      global: 'Pokud již nechcete dostávat žádná upozornění z této služby',
      clickHere: 'klikněte sem'
    },
    en: {
      campaign: 'If you no longer wish to receive notifications about this survey',
      global: 'If you no longer wish to receive any notifications from this service',
      clickHere: 'click here'
    },
    de: {
      campaign: 'Wenn Sie keine Benachrichtigungen mehr zu dieser Umfrage erhalten möchten',
      global: 'Wenn Sie keine Benachrichtigungen mehr von diesem Service erhalten möchten',
      clickHere: 'klicken Sie hier'
    }
  };
  
  const t = translations[language] || translations.en;
  
  return `
    <hr style="margin-top:30px; border:none; border-top:1px solid #ddd;">
    <p style="font-size:11px; color:#999; line-height:1.6;">
      ${t.campaign}, <a href="${campaignUrl}" style="color:#999;">${t.clickHere}</a>.<br>
      ${t.global}, <a href="${globalUrl}" style="color:#999;">${t.clickHere}</a>.
    </p>
  `;
}

/**
 * Replace placeholders in template
 * 
 * @param {string} template - HTML template with placeholders
 * @param {object} placeholders - Key-value pairs for replacement
 * @param {boolean} escapeValues - Whether to escape HTML in values
 * @returns {string} Rendered HTML
 */
function replacePlaceholders(template, placeholders, escapeValues = true) {
  let result = template;
  
  for (const [key, value] of Object.entries(placeholders)) {
    const placeholder = `__${key}__`;
    const safeValue = escapeValues ? escapeHtml(value) : value;
    result = result.replaceAll(placeholder, safeValue);
  }
  
  return result;
}

/**
 * Render email from template
 * 
 * @param {object} options
 * @param {object} options.template - Email template (multilingual JSON)
 * @param {string} options.language - Language code (cs, en, de)
 * @param {object} options.respondent - Respondent data
 * @param {object} options.campaign - Campaign data
 * @param {array} options.customFields - Custom email template fields
 * @param {string} options.publicBaseUrl - Frontend base URL
 * @param {string} options.apiBaseUrl - API base URL
 * @returns {object} {subject, html}
 */
export function renderEmail({
  template,
  language,
  respondent,
  campaign,
  customFields = [],
  publicBaseUrl,
  apiBaseUrl
}) {
  // Select language-specific template
  const langTemplate = template[language] || template.en || template;
  
  if (!langTemplate || !langTemplate.subject || !langTemplate.body) {
    throw new Error(`Invalid email template for language: ${language}`);
  }
  
  // Generate unsubscribe token if not exists
  if (!respondent.unsubscribe_token) {
    throw new Error('Respondent missing unsubscribe_token');
  }
  
  // Build placeholders
  const survey_url = generateSurveyLink(campaign.public_id, respondent.token, publicBaseUrl);
  
  const placeholders = {
    email: respondent.email,
    link: survey_url,
    survey_url: survey_url, // Alias for template compatibility
  };
  
  // Add custom fields from respondent data
  if (respondent.data && typeof respondent.data === 'object') {
    Object.assign(placeholders, respondent.data);
  } else if (typeof respondent.data === 'string') {
    // Try parsing if string
    try {
      const parsed = JSON.parse(respondent.data);
      Object.assign(placeholders, parsed);
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  // Add custom email template fields (multilingual)
  if (Array.isArray(customFields)) {
    customFields.forEach(field => {
      if (field.id && field[language]) {
        placeholders[field.id] = field[language];
      }
    });
  }
  
  // Replace placeholders in subject and body
  let subject = replacePlaceholders(langTemplate.subject, placeholders);
  let html = replacePlaceholders(langTemplate.body, placeholders, false); // Keep HTML
  
  // Add unsubscribe footer
  const footer = getUnsubscribeFooter(respondent.unsubscribe_token, language, apiBaseUrl);
  html = html + footer;
  
  return { subject, html };
}

/**
 * Generate unsubscribe token for respondent
 * (called when creating/updating respondents)
 */
/**
 * Generate random unsubscribe token (64 hex characters)
 */
export function generateUnsubscribeToken() {
  // Generate 32 bytes = 64 hex characters
  const bytes = 32;
  return Array.from(crypto.randomBytes(bytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate email template structure
 */
export function validateEmailTemplate(template, languages = ['en', 'cs', 'de']) {
  if (!template || typeof template !== 'object') {
    return { valid: false, error: 'Template must be an object' };
  }
  
  for (const lang of languages) {
    if (!template[lang]) continue;
    
    const langTemplate = template[lang];
    if (!langTemplate.subject || typeof langTemplate.subject !== 'string') {
      return { valid: false, error: `Missing or invalid subject for language: ${lang}` };
    }
    if (!langTemplate.body || typeof langTemplate.body !== 'string') {
      return { valid: false, error: `Missing or invalid body for language: ${lang}` };
    }
  }
  
  return { valid: true };
}
