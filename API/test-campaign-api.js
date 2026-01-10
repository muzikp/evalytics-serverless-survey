// Test campaign API endpoint - direct database query
import { queryOne } from './src/db.js';

async function test() {
  try {
    const campaignId = '4KS624HEW5PBFFSM';
    
    const campaign = await queryOne(
      `SELECT 
        c.*,
        fv.form_id,
        fv.form_name,
        fv.data as form_data
      FROM campaigns c
      LEFT JOIN form_versions fv ON c.version_id = fv.version_id
      WHERE c.campaign_id = ? AND c.removed = 0`,
      [campaignId]
    );
    
    if (!campaign) {
      console.error('Campaign not found');
      return;
    }
    
    console.log('\n=== CAMPAIGN DATABASE DATA ===');
    console.log('campaign_id:', campaign.campaign_id);
    console.log('version_id:', campaign.version_id);
    console.log('form_id:', campaign.form_id);
    console.log('title type:', typeof campaign.title);
    console.log('title value:', JSON.stringify(campaign.title).substring(0, 100));
    console.log('Has respondent_fields:', !!campaign.respondent_fields);
    console.log('Has email_template_fields:', !!campaign.email_template_fields);
    console.log('Has email_template:', !!campaign.email_template);
    console.log('Has auto_save_interval_seconds:', campaign.auto_save_interval_seconds !== undefined);
    console.log('auto_save_interval_seconds value:', campaign.auto_save_interval_seconds);
    
    console.log('\n=== FIELD VALUES ===');
    if (campaign.respondent_fields) {
      console.log('respondent_fields:', JSON.stringify(campaign.respondent_fields, null, 2));
    }
    if (campaign.email_template_fields) {
      console.log('email_template_fields:', JSON.stringify(campaign.email_template_fields, null, 2));
    }
    if (campaign.email_template) {
      const et = campaign.email_template;
      console.log('email_template type:', typeof et);
      if (typeof et === 'object') {
        console.log('email_template.title:', et.title?.substring(0, 50));
        console.log('email_template.body length:', et.body?.length);
      }
    }
    
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
  }
}

test().catch(console.error);
