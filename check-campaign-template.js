// Check current campaign email template with respondent placeholders
const mysql = require('mysql2/promise');

async function check() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'vcagent',
    password: 'HUIEwhmeAk9I7k7b_Wg8T',
    database: 'evalytics_survey'
  });

  try {
    const [campaigns] = await connection.execute(
      'SELECT campaign_id, email_template, respondent_fields FROM campaigns WHERE campaign_id = ?',
      ['4KS624HEW5PBFFSM']
    );

    if (campaigns.length > 0) {
      const campaign = campaigns[0];
      console.log('Campaign ID:', campaign.campaign_id);
      console.log('\n📧 Email Template:');
      console.log(JSON.stringify(campaign.email_template, null, 2));
      
      console.log('\n👥 Respondent Fields:');
      console.log(JSON.stringify(campaign.respondent_fields, null, 2));
      
      // Check for placeholders in template
      const template = campaign.email_template;
      if (template && template.body) {
        console.log('\n🔍 Placeholders in body:');
        const placeholders = template.body.match(/__\w+__/g) || [];
        placeholders.forEach(p => console.log('  -', p));
      }
    }

  } finally {
    await connection.end();
  }
}

check();
