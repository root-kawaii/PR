-- Fix Marzipano image URLs - the old CDN returns 403 Forbidden
-- Using Pannellum's public demo images which have CORS enabled

UPDATE events
SET marzipano_config = '[
    {
      "id": "main-floor",
      "name": "Main Floor",
      "imageUrl": "https://pannellum.org/images/alma.jpg",
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
      "imageUrl": "https://pannellum.org/images/cerro-toco-0.jpg",
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
WHERE marzipano_config IS NOT NULL
  AND marzipano_config::text LIKE '%marzipano.b-cdn.net%';

-- Verify the update
SELECT id, title,
  marzipano_config->0->>'imageUrl' as scene1_url,
  marzipano_config->1->>'imageUrl' as scene2_url
FROM events
WHERE marzipano_config IS NOT NULL;
