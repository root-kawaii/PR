# Matterport to Marzipano Migration Summary

## Overview

Successfully migrated from Matterport (commercial 3D tour platform) to Marzipano (open-source 360° viewer) for the club events reservation app.

**Date**: January 2026
**Status**: ✅ Implementation Complete

---

## What Changed

### Before (Matterport)
- Commercial platform requiring $69/month subscription
- Simple WebView embed with no SDK integration
- Scrollable table list below 3D tour
- Limited control over UI/UX
- Vendor lock-in

### After (Marzipano)
- Free, open-source solution (no subscription)
- Full SDK integration with hotspot support
- Hotspot-only table selection (immersive experience)
- Complete control over viewer behavior
- No vendor dependencies

---

## Benefits

### Cost Savings
- **Eliminated**: $69/month Matterport subscription
- **Savings**: $828/year per venue

### User Experience
- **More immersive**: Full-screen 360° viewer
- **Interactive**: Click table hotspots directly in 3D view
- **Visual availability**: Green (available) vs gray (unavailable) hotspots
- **Multi-scene navigation**: Move between different venue areas

### Technical
- **Lightweight**: 55KB gzipped library
- **Performance**: Optimized for mobile browsers
- **Flexibility**: Support any 360° image source
- **Customizable**: Full control over viewer UI/UX

---

## Files Created

### Database
- `DB/migrations/025_add_marzipano_support.sql` - Schema changes

### Frontend TypeScript
- `pierre_two/types/index.ts` - Updated with Marzipano types
- `pierre_two/components/event/MarzipanoViewer.tsx` - WebView wrapper component
- `pierre_two/assets/marzipano/viewer.html` - Marzipano viewer implementation

### Backend Rust
- `rust_BE/src/models/event_new.rs` - Updated Event model
- `rust_BE/src/models/table.rs` - Updated Table model

### Documentation
- `docs/MARZIPANO_INTEGRATION_GUIDE.md` - Comprehensive setup guide
- `docs/MATTERPORT_TO_MARZIPANO_MIGRATION.md` - This file
- `pierre_two/assets/marzipano/README.md` - Asset instructions

---

## Files Modified

### Frontend
- `pierre_two/components/event/TableReservationModal.tsx`
  - Removed Matterport WebView section
  - Removed scrollable table list
  - Added MarzipanoViewer component
  - Added scene indicator
  - Implemented hotspot click handling

---

## Database Schema Changes

### Events Table
```sql
ALTER TABLE events ADD COLUMN marzipano_config JSONB;
ALTER TABLE events ADD COLUMN tour_provider VARCHAR(50);
ALTER TABLE events ADD COLUMN tour_id VARCHAR(255);
```

### Tables Table
```sql
ALTER TABLE tables ADD COLUMN marzipano_position JSONB;
```

### Indexes
```sql
CREATE INDEX idx_events_marzipano_config ON events USING GIN (marzipano_config);
CREATE INDEX idx_tables_marzipano_position ON tables USING GIN (marzipano_position);
```

---

## Data Model

### MarzipanoScene Type
```typescript
{
  id: string;
  name: string;
  imageUrl: string;
  initialView?: {yaw, pitch, fov};
  hotspots: MarzipanoHotspot[];
}
```

### MarzipanoHotspot Type
```typescript
{
  id: string;
  type: 'table' | 'scene-link';
  yaw: number;
  pitch: number;
  // For tables:
  tableId?: string;
  tableName?: string;
  available?: boolean;
  // For scene links:
  targetSceneId?: string;
  label?: string;
}
```

### Table.marzipanoPosition
```json
{
  "sceneId": "main-floor",
  "yaw": 1.5708,
  "pitch": -0.2618
}
```

---

## Implementation Phases

### ✅ Phase 1: Database & Types (Completed)
- Created migration SQL
- Updated TypeScript types
- Updated Rust backend models

### ✅ Phase 2: Marzipano Viewer (Completed)
- Created HTML viewer with full SDK integration
- Implemented hotspot rendering and click handling
- Added scene switching with fade transitions
- Created React Native WebView wrapper

### ✅ Phase 3: UI Integration (Completed)
- Refactored TableReservationModal
- Removed Matterport embed
- Removed scrollable table list
- Added full-screen Marzipano viewer
- Implemented table selection via hotspots

### ✅ Phase 4: Documentation (Completed)
- Wrote comprehensive integration guide
- Created migration summary
- Added asset instructions

---

## Next Steps for Production

### 1. Run Database Migration
```bash
psql postgresql://user:pass@host:port/dbname -f DB/migrations/025_add_marzipano_support.sql
```

### 2. Add Placeholder Image
- Download a 360° nightclub image (see `pierre_two/assets/marzipano/README.md`)
- Save as `placeholder-nightclub.jpg` in assets folder
- Or use a free stock image from Freepik/Pixabay

### 3. Build & Deploy Backend
```bash
cd rust_BE
cargo build --release
# Deploy to your server
```

### 4. Build & Deploy Frontend
```bash
cd pierre_two
npm install
npx expo prebuild  # If needed
npx expo start
```

### 5. Test on Devices
- iOS: Test on iPhone 12+ (iOS 15+)
- Android: Test on Pixel 5+ (Android 11+)
- Verify hotspot clicks work
- Check scene navigation
- Test payment modal flow

### 6. Add Real 360° Images
Follow the [Marzipano Integration Guide](./MARZIPANO_INTEGRATION_GUIDE.md):
1. Capture 360° photos of venues
2. Optimize images (< 2MB each)
3. Upload to CDN
4. Update database with image URLs
5. Position table hotspots

---

## Rollback Plan

If issues arise, you can rollback to Matterport:

1. **Database**: Old columns (`matterport_id`) are preserved
2. **Frontend**: Keep old Matterport code commented out
3. **Backend**: Old model fields still exist

To rollback:
```typescript
// In TableReservationModal.tsx, check:
if (event.matterportId && !event.marzipanoScenes) {
  // Show old Matterport view
}
```

---

## Testing Checklist

### Viewer Functionality
- [ ] 360° tour loads successfully
- [ ] Can rotate/pan the view smoothly
- [ ] Scenes load with correct images
- [ ] Scene indicator shows current room name
- [ ] Scene navigation hotspots work

### Table Hotspots
- [ ] Available tables show as green hotspots
- [ ] Unavailable tables show as gray hotspots
- [ ] Clicking available table opens payment modal
- [ ] Clicking unavailable table does nothing
- [ ] Hotspot positions are accurate

### Performance
- [ ] Initial load < 2 seconds on 3G
- [ ] Smooth 60fps rotation on mobile
- [ ] No memory leaks after 10+ modal open/close
- [ ] Images load progressively
- [ ] Scene switching is smooth (< 500ms)

### Cross-Platform
- [ ] Works on iOS Safari WebView
- [ ] Works on Android Chrome WebView
- [ ] Touch gestures work correctly
- [ ] Payment modal integrates properly
- [ ] No WebView crashes or errors

---

## Known Limitations

1. **No placeholder image included** - You must add one for testing
2. **Requires real 360° images** - Can't use regular photos
3. **Manual hotspot positioning** - Need to find coordinates via debug mode
4. **WebView-dependent** - Requires working WebView environment

---

## Resources

- **Marzipano Website**: https://www.marzipano.net/
- **Marzipano GitHub**: https://github.com/google/marzipano
- **Integration Guide**: [MARZIPANO_INTEGRATION_GUIDE.md](./MARZIPANO_INTEGRATION_GUIDE.md)
- **360° Image Resources**: https://www.freepik.com/free-photos-vectors/equirectangular-360

---

## Support

For questions or issues:
1. Check the [Integration Guide](./MARZIPANO_INTEGRATION_GUIDE.md)
2. Review [Marzipano documentation](https://www.marzipano.net/)
3. Open an issue on GitHub
4. Contact the development team

---

**Migration completed successfully! 🎉**
