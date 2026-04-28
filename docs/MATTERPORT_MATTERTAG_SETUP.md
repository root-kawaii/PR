# Matterport Mattertag Setup Guide

## New Matterport Space
**Space ID:** `bccpUngJbTs`
**URL:** https://my.matterport.com/models/bccpUngJbTs

## Overview
This guide explains how to set up Mattertags (clickable markers) in your Matterport 3D tour so users can click on table locations to view details and make reservations.

---

## Step 1: Update Database with New Matterport ID

Run the migration to update all events to use the new Matterport space:

```bash
cd /Users/root-kawaii/Desktop/PR
# Apply the migration (if using a migration tool)
# OR manually run:
psql postgresql://postgres:password@localhost:5432/events -f DB/migrations/024_update_matterport_id.sql
```

**Alternative (if psql not available):**
Use any PostgreSQL client (TablePlus, pgAdmin, etc.) and run:
```sql
UPDATE events SET matterport_id = 'bccpUngJbTs';
```

---

## Step 2: Get Your Table IDs from Database

You need to know your table IDs to create mattertags that match them.

```sql
SELECT id, name, table_number, event_id
FROM tables
ORDER BY table_number;
```

**Example output:**
```
id                                   | name         | table_number | event_id
-------------------------------------|--------------|--------------|----------
550e8400-e29b-41d4-a716-446655440000 | VIP Table 1  | VIP-1        | ...
550e8400-e29b-41d4-a716-446655440001 | VIP Table 2  | VIP-2        | ...
```

**Save these table IDs** - you'll need them for Step 3.

---

## Step 3: Add Mattertags in Matterport Dashboard

### A. Access Your Space
1. Go to https://my.matterport.com
2. Navigate to "My Spaces"
3. Open your space: `bccpUngJbTs`

### B. Enter Edit Mode
1. Click the **"Edit"** button (top right)
2. Click **"Mattertags"** in the editor menu

### C. Create Mattertags for Each Table

For **each table** in your database:

1. **Click on the location** in the 3D tour where the table is located
2. A mattertag creation dialog will appear
3. Fill in the details:

   **Label:** `Table VIP-1` (use your table name or number)

   **Description:**
   ```
   VIP Table - 8 seats
   Minimum spend: €200
   Click to reserve
   ```

   **Label (CRITICAL):**
   - **Must match the table name from your database**
   - Format: Use the EXACT table name (e.g., "Tavolo VIP-1", "Tavolo B-2")
   - You can optionally add "Tavolo" or "Table" prefix, but it will be stripped during matching
   - Example: If database has `name = "VIP-1"`, you can use "VIP-1" or "Tavolo VIP-1"

   **Color:** Choose a color (e.g., green for available, red for reserved)

4. **Click "Save"**

5. **Repeat** for all tables

### D. Mattertag Label Mapping

**IMPORTANT:** The mattertag's **label** (title) must **match** the table's **name** from your database.

**How it works:**
1. When the Matterport SDK loads, the app fetches all mattertag data
2. It extracts the identifier from each mattertag's label
3. It matches the identifier to a table name in your database
4. When a mattertag is clicked, it looks up the matching table

**Matching rules:**
- The label can include prefixes like "Tavolo" or "Table" (they will be stripped)
- Matching is case-insensitive
- Partial matches are supported

**Examples:**
```javascript
// Database table
table.name = "VIP-1"

// Valid mattertag labels (all match):
"VIP-1"          // Exact match
"Tavolo VIP-1"   // With Italian prefix
"Table VIP-1"    // With English prefix

// Database table
table.name = "Tavolo B-2"

// Valid mattertag labels:
"Tavolo B-2"     // Exact match
"B-2"            // Without prefix (partial match)
```

### E. Publish Changes
1. Click **"Publish"** button (top right)
2. Wait for processing to complete
3. Click **"Done"**

---

## Step 4: Test the Integration

### A. Restart Your App
```bash
cd /Users/root-kawaii/Desktop/PR/pierre_two
npm start
```

### B. Test Flow
1. **Open an event** with the Matterport tour
2. **Wait for "SDK Ready"** green badge to appear
3. **Check console logs** for mattertag mapping:
   ```
   Received mattertag data: [{sid: "...", label: "Tavolo VIP-1", ...}, ...]
   Mapped mattertag "Tavolo VIP-1" (abc-123) to table "VIP-1" (550e8400-...)
   Mattertag mapping created: {abc-123: "550e8400-..."}
   ```
4. **Click on a mattertag** in the 3D tour
5. **Check console logs** for click event:
   ```
   Mattertag clicked: abc-123
   Found table: {id: "550e8400-...", name: "VIP-1", ...}
   ```
6. **Payment modal should open** if table is available

### C. Troubleshooting

**If nothing happens when clicking:**
- Open developer console (Chrome DevTools, Safari Web Inspector)
- Look for console messages from the WebView
- Check if "MATTERPORT_READY" appears
- Check if "MATTERTAG_CLICK" appears with the correct sid

**If "No table found for mattertag sid":**
- The mattertag label doesn't match any table name in database
- Check console logs for "Mattertag mapping created" to see what mappings exist
- Verify mattertag label includes the table name (e.g., "Tavolo VIP-1" for table name "VIP-1")
- Check for typos in mattertag labels
- Ensure table names in database match what you used in Matterport labels

**If SDK Ready doesn't appear:**
- Check internet connection
- Verify Matterport space is published and public
- Check WebView console for errors

---

## Step 5: Update Mattertag Colors Based on Availability (Optional)

**This requires Matterport Business plan ($308/month)**

If you upgrade to Business plan, you can dynamically update mattertag colors:

```typescript
// In TableReservationModal.tsx
useEffect(() => {
  if (matterportReady && tables.length > 0) {
    updateMattertagColors(tables);
  }
}, [matterportReady, tables]);

const updateMattertagColors = (tables: Table[]) => {
  tables.forEach(table => {
    const color = table.available
      ? { r: 0.2, g: 0.8, b: 0.4 }  // Green
      : { r: 0.8, g: 0.2, b: 0.2 }; // Red

    webViewRef.current?.injectJavaScript(`
      showcase.Mattertag.editColor('${table.id}', ${JSON.stringify(color)});
    `);
  });
};
```

---

## Quick Reference

### Current Setup
- **Matterport Space:** `bccpUngJbTs`
- **SDK Enabled:** Yes (`&sdk=1` parameter)
- **Click Listeners:** Active
- **Plan:** Professional ($69/month - read-only SDK)

### What Works Now
✅ View 3D tour
✅ Click mattertags to open payment modal
✅ See table details when clicking
✅ Filter by availability (in table list)

### What Requires Business Plan
❌ Programmatically create mattertags from app
❌ Update mattertag colors in real-time
❌ Create custom 3D objects
❌ Control camera position

---

## Example Mattertag Configuration

**Table in Database:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "VIP-1",
  "capacity": 8,
  "minSpend": 200,
  "available": true
}
```

**Mattertag in Matterport:**
```
Label: "Tavolo VIP-1" (or "VIP-1" or "Table VIP-1")
Description: "Premium table - 8 seats\nMinimum spend: €200\nClick to reserve"
Color: Green (#10b981)
Icon: Table or Location Pin
```

**How they connect:**
The app will:
1. Fetch the mattertag with label "Tavolo VIP-1"
2. Extract "VIP-1" from the label (strips "Tavolo" prefix)
3. Match "VIP-1" to the table with name "VIP-1" in database
4. Create mapping: mattertag sid → table id "550e8400-..."
5. When clicked, use mapping to open payment modal for correct table

---

## Support

- **Matterport Help:** https://support.matterport.com
- **SDK Docs:** https://matterport.github.io/showcase-sdk/
- **Your space:** https://my.matterport.com/models/bccpUngJbTs

---

## Next Steps

1. ✅ Update database with new Matterport ID
2. ✅ Get table IDs from database
3. ⏳ Add mattertags in Matterport dashboard
4. ⏳ Test the integration in app
5. ⏳ Add more tables/mattertags as needed

Good luck! 🎉
