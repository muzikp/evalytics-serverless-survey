import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: 'localhost',
  user: 'vcagent',
  password: 'HUIEwhmeAk9I7k7b_Wg8T',
  database: 'evalytics_survey'
};

async function testFormStructure() {
  const conn = await mysql.createConnection(DB_CONFIG);

  try {
    const [rows] = await conn.execute(
      'SELECT c.campaign_id, c.version_id, fv.data FROM campaigns c LEFT JOIN form_versions fv ON c.version_id = fv.version_id WHERE c.campaign_id = ?',
      ['4KS624HEW5PBFFSM']
    );

    const formData = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
    
    console.log('\n📋 Form Structure:\n');
    console.log('Pages:', formData.pages ? formData.pages.length : 0);
    
    if (formData.pages && formData.pages[0] && formData.pages[0].elements) {
      console.log('\n🔍 All Questions:\n');
      formData.pages[0].elements.forEach((q, i) => {
        console.log(`\n${i + 1}. ${q.name} (${q.type}):`);
        if (q.choices) {
          console.log('  Choices:', JSON.stringify(q.choices, null, 2));
        }
      });
    }

  } finally {
    await conn.end();
  }
}

testFormStructure().catch(console.error);
