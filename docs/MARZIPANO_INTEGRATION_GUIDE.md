# Marzipano 360° Image Integration Guide

## Overview

This guide explains how to add real 360° panoramic images to your club events and configure table hotspots for the Marzipano viewer.

**What is Marzipano?**
Marzipano is a free, open-source 360° media viewer developed by Google. It's lightweight (55KB gzipped), supports all modern browsers, and allows you to create immersive virtual tours without subscription fees.

---

## Prerequisites

- Admin access to the events database
- 360° equirectangular images (JPG/PNG, 4096×2048 recommended)
- Image hosting solution (AWS S3, Cloudinary, or similar)
- PostgreSQL access for database updates

---

## Step 1: Capture or Obtain 360° Images

### Option A: Professional 360° Camera (Recommended)

**Recommended Cameras:**
- **Ricoh Theta Z1** (~$1,000) - Professional quality, 23MP, RAW support
- **Insta360 X3** (~$450) - Great value, 72MP photo mode, waterproof
- **GoPro Max** (~$500) - Good stabilization, familiar GoPro interface

**Shooting Tips:**
1. Shoot at eye level (5-6 feet/1.5-1.8m high)
2. Ensure good, even lighting throughout the venue
3. Use highest resolution available
4. Take multiple shots from different positions in each room
5. Avoid placing camera near tables you want to highlight
6. Hide the camera operator or use timer/remote

### Option B: Hire a 360° Photographer

Search for "360 virtual tour photographer [your city]" or use services like:
- Kuula marketplace
- Matterport certified photographers
- Local real estate photographers

**What to request:**
- Equirectangular format output (not proprietary formats)
- High resolution (minimum 4096×2048px)
- RAW files if possible
- Multiple scenes (one per room/area)

**Typical Cost:** $200-500 per venue location

### Option C: Convert Existing Virtual Tours

If you have existing Matterport, Kuula, or CloudPano tours:
1. Contact the service provider
2. Request equirectangular image exports
3. Note: May require Business/Pro plan
4. Alternative: Screenshot the tour (lower quality)

---

## Step 2: Process and Optimize Images

### Image Specifications

| Property | Requirement | Notes |
|----------|-------------|-------|
| Format | JPEG (recommended) or PNG | JPEG has better compression |
| Resolution | 4096×2048px minimum | 2:1 aspect ratio (width = 2 × height) |
| File Size | < 2MB per image | Critical for mobile performance |
| Color Space | sRGB | Standard for web |
| Projection | Equirectangular | Must be equirectangular, not cubemap |

### Optimization Tools

**Option 1: ImageMagick (Command Line)**
```bash
# Resize and compress
convert input.jpg -resize 4096x2048 -quality 85 output.jpg

# Batch process multiple images
for img in *.jpg; do
  convert "$img" -resize 4096x2048 -quality 85 "optimized_$img"
done
```

**Option 2: Squoosh (Online, Recommended)**
1. Visit https://squoosh.app
2. Upload your 360° image
3. Select MozJPEG codec
4. Set quality to 80-85
5. Ensure dimensions are 4096×2048
6. Download optimized image

**Option 3: Photoshop**
1. Open image in Photoshop
2. Image → Image Size → 4096×2048px
3. File → Export → Save for Web
4. JPEG quality: 80-85
5. Optimize for web

### Quality Checklist

- [ ] Image is equirectangular (not cubemap or other projection)
- [ ] Aspect ratio is exactly 2:1
- [ ] File size is under 2MB
- [ ] No visible compression artifacts
- [ ] Horizon line is level
- [ ] No "stitch lines" visible
- [ ] Colors look natural (not oversaturated)

---

## Step 3: Upload Images to CDN

### Option A: AWS S3 + CloudFront

**Setup:**
```bash
# Install AWS CLI
brew install awscli  # macOS
# or: pip install awscli

# Configure AWS credentials
aws configure

# Create S3 bucket
aws s3 mb s3://your-venue-360-images

# Set bucket policy for public read access
aws s3api put-bucket-policy --bucket your-venue-360-images --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::your-venue-360-images/*"
  }]
}'

# Upload images
aws s3 cp main-floor.jpg s3://your-venue-360-images/venues/venue-123/main-floor.jpg --acl public-read
aws s3 cp vip-room.jpg s3://your-venue-360-images/venues/venue-123/vip-room.jpg --acl public-read
```

**Get URLs:**
- Direct S3: `https://your-venue-360-images.s3.amazonaws.com/venues/venue-123/main-floor.jpg`
- With CloudFront: `https://d1234abcd.cloudfront.net/venues/venue-123/main-floor.jpg`

### Option B: Cloudinary

**Setup:**
1. Sign up at https://cloudinary.com (free tier available)
2. Install Cloudinary CLI or use web interface
3. Upload images via dashboard

**Via CLI:**
```bash
# Install
npm install -g cloudinary-cli

# Configure
cloudinary config

# Upload
cloudinary upload main-floor.jpg --folder venues/venue-123 --public-id main-floor
```

**Get URL:**
`https://res.cloudinary.com/your-cloud-name/image/upload/venues/venue-123/main-floor.jpg`

### Option C: Your Own Server

If hosting on your own server:
```bash
# Copy to server
scp *.jpg user@your-server.com:/var/www/html/360-images/

# Ensure web server serves with correct CORS headers
# In nginx.conf:
location /360-images/ {
    add_header Access-Control-Allow-Origin *;
    add_header Cache-Control "public, max-age=31536000";
}
```

**URL:** `https://your-domain.com/360-images/main-floor.jpg`

---

## Step 4: Configure Event Scenes in Database

### Understanding the Data Structure

The `marzipano_config` column stores a JSON array of scenes:

```json
[
  {
    "id": "main-floor",           // Unique scene identifier
    "name": "Main Floor",          // Display name
    "imageUrl": "https://...",     // URL to 360° image
    "initialView": {               // Camera position when scene loads
      "yaw": 0,                    // Horizontal rotation (radians, 0 = forward)
      "pitch": 0,                  // Vertical rotation (radians, 0 = horizon)
      "fov": 1.5708                // Field of view (radians, 1.5708 = 90°)
    },
    "hotspots": []                 // Scene navigation hotspots
  }
]
```

### Single Scene Example

For a venue with just one room:

```sql
UPDATE events
SET
  tour_provider = 'marzipano',
  marzipano_config = '[
    {
      "id": "main-room",
      "name": "Main Room",
      "imageUrl": "https://your-cdn.com/venues/club-xyz/main-room.jpg",
      "initialView": {
        "yaw": 0,
        "pitch": 0,
        "fov": 1.5708
      },
      "hotspots": []
    }
  ]'::jsonb
WHERE id = '550e8400-e29b-41d4-a716-446655440001';  -- Your event ID
```

### Multi-Scene Example

For a venue with multiple rooms:

```sql
UPDATE events
SET
  tour_provider = 'marzipano',
  marzipano_config = '[
    {
      "id": "main-floor",
      "name": "Main Floor",
      "imageUrl": "https://your-cdn.com/venues/club-xyz/main-floor.jpg",
      "initialView": {"yaw": 0, "pitch": 0, "fov": 1.5708},
      "hotspots": [
        {
          "id": "link-to-vip",
          "type": "scene-link",
          "yaw": 1.5708,
          "pitch": 0,
          "targetSceneId": "vip-room",
          "label": "→ VIP Room"
        }
      ]
    },
    {
      "id": "vip-room",
      "name": "VIP Room",
      "imageUrl": "https://your-cdn.com/venues/club-xyz/vip-room.jpg",
      "initialView": {"yaw": 3.14159, "pitch": 0, "fov": 1.5708},
      "hotspots": [
        {
          "id": "link-to-main",
          "type": "scene-link",
          "yaw": 0,
          "pitch": 0,
          "targetSceneId": "main-floor",
          "label": "← Back to Main Floor"
        }
      ]
    }
  ]'::jsonb
WHERE id = '550e8400-e29b-41d4-a716-446655440001';
```

---

## Step 5: Position Table Hotspots

Tables appear as clickable hotspots in the 360° view. You need to set their position (yaw/pitch coordinates).

### Understanding Coordinates

**Yaw** (Horizontal rotation):
- 0 radians = straight ahead
- π/2 (1.5708) = 90° to the right
- π (3.14159) = 180° behind
- 3π/2 (4.7124) = 270° to the left
- Range: 0 to 2π (0 to 6.28318)

**Pitch** (Vertical rotation):
- 0 radians = horizon (eye level)
- Positive = looking up
- Negative = looking down
- Range: -π/2 to π/2 (-1.5708 to 1.5708)

**Conversion:** Degrees to radians = degrees × π / 180
- 90° = 1.5708 rad
- 180° = 3.14159 rad
- 45° = 0.7854 rad

### Method 1: Find Coordinates Using Debug Mode (Recommended)

1. **Enable debug logging in the app:**

Edit `pierre_two/assets/marzipano/viewer.html` and add:

```javascript
// After viewer is created, add this:
viewer.view().addEventListener('change', () => {
  const view = viewer.view();
  console.log('Current view:', {
    yaw: view.yaw().toFixed(4),
    pitch: view.pitch().toFixed(4),
    fov: view.fov().toFixed(4)
  });
});
```

2. **Open the app in development mode**
3. **Navigate to an event with the 360° tour**
4. **Open browser console** (Safari Web Inspector or Chrome DevTools for React Native debugger)
5. **Look around until you find a table**
6. **Note the yaw and pitch values** from console
7. **Use these coordinates** in the database update below

### Method 2: Use Online Marzipano Tool

1. Visit https://renderstuff.com/tools/360-panorama-web-viewer/
2. Upload your 360° image
3. Click where you want to place a table
4. Note the coordinates (convert degrees to radians)

### Update Table Positions in Database

```sql
-- Single table example
UPDATE tables
SET marzipano_position = '{
  "sceneId": "main-floor",
  "yaw": 1.5708,
  "pitch": -0.2618
}'::jsonb
WHERE name = 'VIP Table 1' AND event_id = '550e8400-e29b-41d4-a716-446655440001';

-- Batch update multiple tables
UPDATE tables
SET marzipano_position = CASE name
  WHEN 'VIP Table 1' THEN '{"sceneId": "main-floor", "yaw": 1.5708, "pitch": -0.2618}'::jsonb
  WHEN 'VIP Table 2' THEN '{"sceneId": "main-floor", "yaw": 2.3562, "pitch": -0.1745}'::jsonb
  WHEN 'Bar Table 1' THEN '{"sceneId": "main-floor", "yaw": 4.7124, "pitch": -0.3491}'::jsonb
  WHEN 'Lounge Table 1' THEN '{"sceneId": "vip-room", "yaw": 0.7854, "pitch": -0.2618}'::jsonb
  ELSE marzipano_position
END
WHERE event_id = '550e8400-e29b-41d4-a716-446655440001';
```

### Positioning Tips

- Place hotspots **slightly above** the actual table (pitch = -0.2 to -0.4 radians)
- Space hotspots at least **0.5 radians apart** to avoid overlap
- Test on mobile device to ensure hotspots are easily tappable
- Don't place hotspots at extreme pitch angles (too high or low)

---

## Step 6: Add Scene Navigation Hotspots (Multi-Scene Only)

If your venue has multiple rooms, add navigation hotspots so users can move between scenes.

### Example: Doorway Hotspot

```sql
-- Add a "Go to VIP Room" hotspot on the Main Floor
UPDATE events
SET marzipano_config = jsonb_set(
  marzipano_config,
  '{0,hotspots}',  -- First scene (index 0), hotspots array
  COALESCE(marzipano_config->0->'hotspots', '[]'::jsonb) || '[{
    "id": "doorway-to-vip",
    "type": "scene-link",
    "yaw": 0.7854,
    "pitch": 0,
    "targetSceneId": "vip-room",
    "label": "→ VIP Room"
  }]'::jsonb
)
WHERE id = '550e8400-e29b-41d4-a716-446655440001';

-- Add a "Back to Main Floor" hotspot in VIP Room
UPDATE events
SET marzipano_config = jsonb_set(
  marzipano_config,
  '{1,hotspots}',  -- Second scene (index 1)
  COALESCE(marzipano_config->1->'hotspots', '[]'::jsonb) || '[{
    "id": "door-to-main",
    "type": "scene-link",
    "yaw": 3.14159,
    "pitch": 0,
    "targetSceneId": "main-floor",
    "label": "← Main Floor"
  }]'::jsonb
)
WHERE id = '550e8400-e29b-41d4-a716-446655440001';
```

### Navigation Best Practices

- Place scene-link hotspots near **actual doorways/entrances**
- Use **clear labels** with arrows (→, ←)
- Ensure **bi-directional navigation** (can go back and forth)
- Set `pitch: 0` for doorways (eye-level)
- Test navigation flow before launch

---

## Step 7: Test the Integration

### Testing Checklist

#### Desktop Testing (Development)
- [ ] Open event in app (development mode)
- [ ] 360° tour loads within 2-3 seconds
- [ ] Can rotate/pan the view smoothly
- [ ] All scenes load correctly
- [ ] Table hotspots appear in correct positions
- [ ] Clicking available table opens payment modal
- [ ] Clicking unavailable table does nothing
- [ ] Scene navigation hotspots work
- [ ] Scene indicator shows current room name

#### Mobile Testing (iOS)
- [ ] Test on iPhone 12 or newer (iOS 15+)
- [ ] 360° view is smooth (60fps)
- [ ] Hotspots are easy to tap
- [ ] No lag when switching scenes
- [ ] Images load on cellular data (3G/4G)
- [ ] Payment modal works after selecting table

#### Mobile Testing (Android)
- [ ] Test on Pixel 5 or equivalent (Android 11+)
- [ ] WebView loads without errors
- [ ] Touch gestures work smoothly
- [ ] Hotspots are visible and tappable
- [ ] No crashes or memory issues

### Common Issues & Solutions

#### Issue: Hotspot in wrong position
**Solution:**
- Adjust yaw (left/right) or pitch (up/down)
- Each 0.1 radians ≈ 5.7 degrees
- Use debug mode to find exact coordinates

#### Issue: Image looks distorted or stretched
**Solution:**
- Ensure image has exactly 2:1 aspect ratio
- Verify it's equirectangular projection (not cubemap)
- Check image wasn't cropped or resized incorrectly

#### Issue: Image loads slowly or not at all
**Solution:**
- Compress image to < 2MB
- Use progressive JPEG format
- Verify CDN is configured correctly
- Check CORS headers are set
- Test image URL in browser directly

#### Issue: Table hotspots don't appear
**Solution:**
- Verify `marzipano_position` is set in database
- Check `sceneId` matches scene in `marzipano_config`
- Ensure position coordinates are within valid ranges
- Look for JavaScript errors in WebView console

#### Issue: "360° tour not available" message shows
**Solution:**
- Verify `tour_provider = 'marzipano'` in database
- Ensure `marzipano_config` is valid JSON
- Check event has at least one scene configured
- Restart app to reload data

---

## Step 8: Performance Optimization

### Image Optimization

**Progressive JPEG:**
```bash
# Convert to progressive JPEG for faster perceived loading
convert input.jpg -interlace Plane output.jpg
```

**WebP Format (if supported):**
```bash
# Create WebP version (25-35% smaller than JPEG)
cwebp -q 80 input.jpg -o output.webp

# Use in database with fallback:
# Check browser support and serve WebP to supported browsers
```

### CDN Configuration

**CloudFront Cache Settings:**
```javascript
{
  "DefaultCacheBehavior": {
    "MinTTL": 86400,           // 1 day minimum
    "MaxTTL": 31536000,        // 1 year maximum
    "DefaultTTL": 2592000,     // 30 days default
    "Compress": true           // Enable compression
  }
}
```

**Cache-Control Headers:**
```
Cache-Control: public, max-age=31536000, immutable
```

### Preloading Strategy

For multi-scene tours, preload next scene in background:
- Edit `viewer.html` to add preloading logic
- Loads next scene's image while user views current scene
- Reduces wait time when switching scenes

---

## Step 9: Maintenance & Updates

### Updating Images

**To replace an existing 360° image:**

1. Upload new image to CDN with **new filename**:
   ```bash
   aws s3 cp main-floor-v2.jpg s3://your-bucket/venues/venue-123/main-floor-v2.jpg
   ```

2. Update database URL:
   ```sql
   UPDATE events
   SET marzipano_config = jsonb_set(
     marzipano_config,
     '{0,imageUrl}',
     '"https://your-cdn.com/venues/venue-123/main-floor-v2.jpg"'::jsonb
   )
   WHERE id = '550e8400-e29b-41d4-a716-446655440001';
   ```

3. Or use cache-busting query parameter:
   ```
   https://your-cdn.com/venues/venue-123/main-floor.jpg?v=2
   ```

### Adding New Tables

```sql
-- Insert new table
INSERT INTO tables (id, event_id, name, zone, capacity, min_spend, total_cost, available, marzipano_position, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '550e8400-e29b-41d4-a716-446655440001',
  'New VIP Table',
  'VIP',
  8,
  250.00,
  250.00,
  true,
  '{"sceneId": "main-floor", "yaw": 2.5, "pitch": -0.3}'::jsonb,
  NOW(),
  NOW()
);
```

The app will automatically show the new hotspot on next load.

### Removing Scenes

```sql
-- Remove second scene (index 1)
UPDATE events
SET marzipano_config = marzipano_config - 1
WHERE id = '550e8400-e29b-41d4-a716-446655440001';

-- Also update/remove tables that were in that scene
UPDATE tables
SET marzipano_position = NULL
WHERE marzipano_position->>'sceneId' = 'vip-room'
  AND event_id = '550e8400-e29b-41d4-a716-446655440001';
```

---

## Troubleshooting Reference

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Black screen | Image URL incorrect | Check URL is accessible in browser |
| Distorted view | Wrong aspect ratio | Ensure image is 2:1 (width:height) |
| Hotspot missing | Position not set | Check `marzipano_position` in database |
| Hotspot in wrong place | Incorrect coordinates | Use debug mode to find correct yaw/pitch |
| Slow loading | Image too large | Compress to < 2MB |
| Can't click hotspot | Overlap with other hotspot | Space hotspots 0.5+ radians apart |
| Scene won't switch | Invalid targetSceneId | Check sceneId matches config |
| "Tour not available" | Missing config | Verify `marzipano_config` is set |

---

## FAQ

**Q: Can I use photos from a regular camera?**
A: No, you need a 360° camera that captures a full spherical panorama. Regular cameras don't have the 360° field of view.

**Q: What if I don't have a 360° camera?**
A: Hire a 360° photographer ($200-500) or rent a camera for a day (~$50-100).

**Q: Can I use Matterport images?**
A: Yes, if you can export them. Matterport Business plan allows equirectangular exports.

**Q: How many scenes should I have per venue?**
A: Typically 2-5 scenes. Main room, VIP area, bar, outdoor patio, etc. More scenes = more images to manage.

**Q: Can users zoom in/out?**
A: Yes, Marzipano supports pinch-to-zoom on mobile and scroll-to-zoom on desktop.

**Q: Do hotspots update in real-time when tables are reserved?**
A: Yes! The app updates hotspot colors dynamically based on table availability.

**Q: Can I preview the 360° view before deploying?**
A: Yes, use https://renderstuff.com/tools/360-panorama-web-viewer/ to preview your images.

**Q: What's the difference between yaw and pitch?**
A: **Yaw** = horizontal rotation (left/right), **Pitch** = vertical rotation (up/down).

**Q: How do I convert degrees to radians?**
A: Multiply by π/180. Example: 90° = 90 × 3.14159 / 180 = 1.5708 radians.

---

## Resources

### Tools
- **Squoosh** - Image optimization: https://squoosh.app
- **360° Panorama Viewer** - Preview tool: https://renderstuff.com/tools/360-panorama-web-viewer/
- **ImageMagick** - Command-line image processing: https://imagemagick.org

### Learning
- **Marzipano Documentation**: https://www.marzipano.net/
- **Marzipano GitHub**: https://github.com/google/marzipano
- **Equirectangular Projection Guide**: https://wiki.panotools.org/Equirectangular
- **360° Photography Tutorial**: https://www.youtube.com/results?search_query=360+photography+tutorial

### Camera Reviews
- **Ricoh Theta**: https://theta360.com
- **Insta360**: https://www.insta360.com
- **360° Camera Comparison**: https://www.dpreview.com/reviews/buying-guide-best-360-degree-cameras

### Services
- **Kuula** - Hosting & marketplace: https://kuula.co
- **Cloudinary** - Image CDN: https://cloudinary.com
- **AWS S3** - File storage: https://aws.amazon.com/s3/

---

## Next Steps

1. ✅ Read this guide thoroughly
2. ⏳ Capture or obtain 360° images for your venues
3. ⏳ Optimize and upload images to CDN
4. ⏳ Configure database with scene URLs
5. ⏳ Position table hotspots using debug mode
6. ⏳ Test on multiple devices
7. ⏳ Launch to production
8. ⏳ Monitor performance and user feedback

---

## Support

For technical issues or questions:
- **Marzipano Issues**: https://github.com/google/marzipano/issues
- **App Issues**: Contact your development team
- **360° Photography**: Search for local photographers or online forums

**Happy touring! 🎉**
