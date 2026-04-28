const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.xxqexjtkgjfvhdyuoovq:WishYouWereHere75!@aws-1-eu-central-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const sql = `
UPDATE events
SET marzipano_config = '[
    {
      "id": "main-floor",
      "name": "Main Floor",
      "imageUrl": "https://pannellum.org/images/alma.jpg",
      "initialView": {"yaw": 0, "pitch": 0, "fov": 1.5708},
      "hotspots": [
        {"id": "table-vip-1", "type": "table", "yaw": 0.5, "pitch": -0.2, "tableId": null, "tableName": "VIP Table 1", "available": true},
        {"id": "link-to-vip", "type": "scene-link", "yaw": -0.8, "pitch": 0, "targetSceneId": "vip-area", "label": "→ VIP Area"}
      ]
    },
    {
      "id": "vip-area",
      "name": "VIP Area",
      "imageUrl": "https://pannellum.org/images/cerro-toco-0.jpg",
      "initialView": {"yaw": 0, "pitch": 0, "fov": 1.5708},
      "hotspots": [
        {"id": "table-vip-2", "type": "table", "yaw": 0.3, "pitch": -0.15, "tableId": null, "tableName": "VIP Table 2", "available": true},
        {"id": "link-to-main", "type": "scene-link", "yaw": 3.0, "pitch": 0, "targetSceneId": "main-floor", "label": "← Main Floor"}
      ]
    }
  ]'::jsonb
WHERE marzipano_config IS NOT NULL;
`;

async function run() {
  try {
    await client.connect();
    console.log('Connected to database...');

    const result = await client.query(sql);
    console.log('✅ Migration successful! Rows updated:', result.rowCount);

    // Verify the update
    const verify = await client.query(`
      SELECT id, title, marzipano_config->0->>'imageUrl' as image_url
      FROM events
      WHERE marzipano_config IS NOT NULL
    `);
    console.log('Updated events:');
    verify.rows.forEach(row => {
      console.log(`  - ${row.title}: ${row.image_url}`);
    });

    await client.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

run();
