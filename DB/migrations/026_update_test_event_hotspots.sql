-- Update the test event "NEON NIGHTS - SPECIAL EVENT" with proper Marzipano configuration
-- This adds:
-- 1. Two 360° scenes (main floor and VIP area)
-- 2. Table hotspots on both scenes for reservations
-- 3. Scene-link hotspots to navigate between scenes

UPDATE events
SET
  tour_provider = 'marzipano',
  marzipano_config = '[
    {
      "id": "main-floor",
      "name": "Main Floor",
      "imageUrl": "https://marzipano.b-cdn.net/demos/sample/1-reception/1-l1.jpg",
      "initialView": {
        "yaw": 0,
        "pitch": 0,
        "fov": 1.5708
      },
      "hotspots": [
        {
          "id": "table-vip-1",
          "type": "table",
          "yaw": 0.5,
          "pitch": -0.2,
          "tableId": null,
          "tableName": "VIP Table 1",
          "available": true
        },
        {
          "id": "link-to-vip",
          "type": "scene-link",
          "yaw": -0.8,
          "pitch": 0,
          "targetSceneId": "vip-area",
          "label": "→ VIP Area"
        }
      ]
    },
    {
      "id": "vip-area",
      "name": "VIP Area",
      "imageUrl": "https://marzipano.b-cdn.net/demos/sample/2-bedroom/2-l1.jpg",
      "initialView": {
        "yaw": 0,
        "pitch": 0,
        "fov": 1.5708
      },
      "hotspots": [
        {
          "id": "table-vip-2",
          "type": "table",
          "yaw": 0.3,
          "pitch": -0.15,
          "tableId": null,
          "tableName": "VIP Table 2",
          "available": true
        },
        {
          "id": "link-to-main",
          "type": "scene-link",
          "yaw": 3.0,
          "pitch": 0,
          "targetSceneId": "main-floor",
          "label": "← Main Floor"
        }
      ]
    }
  ]'::jsonb
WHERE title = 'NEON NIGHTS - SPECIAL EVENT';

-- Verify the update
SELECT
  id,
  title,
  tour_provider,
  jsonb_array_length(marzipano_config) as scene_count
FROM events
WHERE title = 'NEON NIGHTS - SPECIAL EVENT';
