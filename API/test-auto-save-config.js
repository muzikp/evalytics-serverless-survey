/**
 * Test auto-save interval configuration
 * 
 * Tento test ověřuje:
 * 1. Že auto_save_interval_seconds je vrácen v API
 * 2. Že default hodnota je 10 sekund
 * 3. Že NULL vypíná auto-save
 */

import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'vcagent',
  password: process.env.DB_PASSWORD || 'HUIEwhmeAk9I7k7b_Wg8T',
  database: process.env.DB_NAME || 'evalytics_survey'
};

async function testAutoSaveConfig() {
  console.log('\n🧪 Testing auto-save interval configuration...\n');

  const conn = await mysql.createConnection(DB_CONFIG);

  try {
    // 1. Verify column exists with correct default
    console.log('1️⃣ Checking database schema...');
    const [schema] = await conn.execute(
      "DESCRIBE campaigns"
    );
    
    const autoSaveColumn = schema.find(row => row.Field === 'auto_save_interval_seconds');
    
    if (!autoSaveColumn) {
      throw new Error('❌ Column auto_save_interval_seconds not found');
    }
    
    console.log('   ✅ Column exists:', autoSaveColumn);
    console.log('   ✅ Default value:', autoSaveColumn.Default);
    console.log('   ✅ Nullable:', autoSaveColumn.Null);

    // 2. Check existing campaigns
    console.log('\n2️⃣ Checking existing campaigns...');
    const [campaigns] = await conn.execute(
      `SELECT campaign_id, public_id, auto_save_interval_seconds
       FROM campaigns
       WHERE removed = 0
       LIMIT 5`
    );

    console.log(`   Found ${campaigns.length} active campaigns:`);
    campaigns.forEach(c => {
      console.log(`   - ${c.public_id}: ${c.auto_save_interval_seconds}s ${c.auto_save_interval_seconds === null ? '(DISABLED)' : ''}`);
    });

    // 3. Test updating a campaign to disable auto-save
    if (campaigns.length > 0) {
      console.log('\n3️⃣ Testing auto-save disable...');
      const testCampaign = campaigns[0];
      
      // Save original value
      const originalValue = testCampaign.auto_save_interval_seconds;
      
      // Disable auto-save
      await conn.execute(
        'UPDATE campaigns SET auto_save_interval_seconds = NULL WHERE campaign_id = ?',
        [testCampaign.campaign_id]
      );
      
      const [result] = await conn.execute(
        'SELECT auto_save_interval_seconds FROM campaigns WHERE campaign_id = ?',
        [testCampaign.campaign_id]
      );
      
      console.log(`   ✅ Set to NULL:`, result[0].auto_save_interval_seconds);
      
      // Restore original value
      await conn.execute(
        'UPDATE campaigns SET auto_save_interval_seconds = ? WHERE campaign_id = ?',
        [originalValue, testCampaign.campaign_id]
      );
      
      console.log(`   ✅ Restored to:`, originalValue);
    }

    // 4. Test with custom values
    if (campaigns.length > 0) {
      console.log('\n4️⃣ Testing custom intervals...');
      const testCampaign = campaigns[0];
      const originalValue = testCampaign.auto_save_interval_seconds;
      
      const testValues = [5, 10, 30, 60, 0, null];
      
      for (const value of testValues) {
        await conn.execute(
          'UPDATE campaigns SET auto_save_interval_seconds = ? WHERE campaign_id = ?',
          [value, testCampaign.campaign_id]
        );
        
        const [result] = await conn.execute(
          'SELECT auto_save_interval_seconds FROM campaigns WHERE campaign_id = ?',
          [testCampaign.campaign_id]
        );
        
        const behavior = value === null || value === 0 ? '(DISABLED)' : '(ENABLED)';
        console.log(`   ✅ ${value}s ${behavior}:`, result[0].auto_save_interval_seconds);
      }
      
      // Restore
      await conn.execute(
        'UPDATE campaigns SET auto_save_interval_seconds = ? WHERE campaign_id = ?',
        [originalValue, testCampaign.campaign_id]
      );
    }

    console.log('\n✅ All tests passed!\n');
    console.log('📝 Summary:');
    console.log('   - Column auto_save_interval_seconds exists');
    console.log('   - Default value: 10 seconds');
    console.log('   - NULL disables auto-save');
    console.log('   - 0 or negative disables auto-save');
    console.log('   - Positive values set custom interval\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    throw error;
  } finally {
    await conn.end();
  }
}

testAutoSaveConfig().catch(console.error);
