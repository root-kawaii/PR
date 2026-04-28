# Area Grouping In 360 Menu Plan

## Goal

Change the dropdown menu in the 360deg venue view so it is grouped by
areas instead of individual tables/zones, while preserving the user-selected
theme from Settings.

Also enforce that every table has an area. Existing rows with no area must be
backfilled to a default area such as `"A"`.

## Current State

- The 360 menu is rendered by [TableFilterMenu.tsx](/Users/root-kawaii/Desktop/PR/pierre_two/components/event/TableFilterMenu.tsx).
- It currently groups rows by `table.zone`, not by a real area entity.
- The menu uses hardcoded dark colors, so it does not reliably reflect the
  selected app theme.
- The database already has an `areas` table and a nullable `tables.area_id`
  introduced in [033_create_areas.sql](/Users/root-kawaii/Desktop/PR/DB/migrations/033_create_areas.sql).
- The backend table model already exposes `area_id`, but the frontend `Table`
  type does not yet include area metadata.
  
## Important Data-Model Decision

Before implementation, confirm the cardinality of the area model.

### Recommended default model

For the use case shown in the UI, an area like `MAIN FLOOR`, `BAR AREA`, or
`VIP AREA` appears to contain many tables. In that case the correct source of
truth is:

- `areas.club_id`
- `tables.area_id`

This means:

- an area belongs to a club
- many tables can belong to the same area

### When `areas.table_id` would make sense

Add `areas.table_id` only if product requirements actually need one of these:

- one area corresponds to exactly one table
- an area needs a representative or anchor table
- the 360 viewer needs a specific reference table per area

If `areas.table_id` is added without a real reason, it risks creating two
conflicting sources of truth:

- `tables.area_id`
- `areas.table_id`

So the implementation should keep `tables.area_id` as the primary linkage
unless the review proves otherwise.

## Implementation Plan

### 1. Confirm the current end-to-end flow

- Verify how tables are fetched for the 360 modal in
  [TableReservationModal.tsx](/Users/root-kawaii/Desktop/PR/pierre_two/components/event/TableReservationModal.tsx).
- Verify how grouping is currently built in
  [TableFilterMenu.tsx](/Users/root-kawaii/Desktop/PR/pierre_two/components/event/TableFilterMenu.tsx).
- Verify where hardcoded colors are bypassing theme values.

### 2. Finalize the area relationship model

- Decide whether `areas` should:
  - keep only `club_id`
  - add `table_id`
  - keep `club_id` and add `table_id`
- Default decision should remain:
  - `areas.club_id`
  - `tables.area_id`
- Only add `areas.table_id` if there is a clear product need and a single
  unambiguous rule for how it coexists with `tables.area_id`.

### 3. Update backend table responses

- Extend the backend response so each table exposes area metadata that is easy
  for the frontend to consume.
- At minimum include:
  - `areaId`
  - `areaName`
- Keep `zone` temporarily if needed for compatibility, but stop using it as the
  primary grouping input for the 360 dropdown.

### 4. Add migration for default-area backfill

- Create a new numbered migration in `DB/migrations/`.
- For every club that has tables with `area_id IS NULL`, create or reuse a
  default area named `"A"`.
- Assign all null-area tables for that club to the default `"A"` area.
- Make the migration idempotent enough to run safely in non-fresh environments.

### 5. Add migration to enforce non-null area

- After backfill succeeds, make `tables.area_id` `NOT NULL`.
- If needed, also add constraints or logic to prevent future inserts from
  silently storing null area values.

### 6. Update creation/update logic in the backend

- Review table creation and update paths in:
  - [table_persistence.rs](/Users/root-kawaii/Desktop/PR/rust_BE/src/infrastructure/repositories/table_persistence.rs)
  - related controllers/services
- Ensure new tables always receive a valid area.
- If the client does not pass an area, assign the default `"A"` area for the
  appropriate club instead of allowing null.

### 7. Update local/dev data

- Add or update sample data so development environments include:
  - areas with names like `MAIN FLOOR`, `BAR AREA`, `VIP AREA`
  - tables assigned to those areas
  - at least one legacy/null-area case covered by migration behavior

### 8. Update frontend table typing

- Extend [types/index.ts](/Users/root-kawaii/Desktop/PR/pierre_two/types/index.ts)
  so `Table` includes area metadata from the backend.
- Example fields:
  - `areaId?: string`
  - `areaName?: string`

### 9. Change 360 dropdown grouping logic

- In [TableFilterMenu.tsx](/Users/root-kawaii/Desktop/PR/pierre_two/components/event/TableFilterMenu.tsx),
  group filtered rows by area instead of `zone`.
- Section headers should display area names and counts, for example:
  - `MAIN FLOOR (4 disponibili)`
  - `BAR AREA (2 disponibili)`
- Search, price filter, and sorting should continue to work as they do now.

### 10. Preserve the selected theme

- Remove hardcoded dark palette values from `TableFilterMenu`.
- Use the current theme from `useTheme()` for:
  - panel background
  - section headers
  - borders
  - selected row state
  - input background
  - text colors
  - close button styling
- Check surrounding 360 overlay controls in
  [TableReservationModal.tsx](/Users/root-kawaii/Desktop/PR/pierre_two/components/event/TableReservationModal.tsx)
  so the experience feels consistent with the chosen theme.

### 11. Compatibility cleanup

- Decide whether `zone` should remain only as a legacy/display field or be
  phased out over time.
- Avoid showing mixed terminology where one screen says `zone` and another says
  `area` for the same concept unless there is a real distinction.

### 12. Verification

- Verify with tables that already have areas.
- Verify with legacy rows that start with null area before migration.
- Verify the default `"A"` area gets created when needed.
- Verify new tables cannot end up without an area.
- Verify the 360 dropdown groups by area and not by table/zone.
- Verify the selected user theme is preserved in the 360 menu UI.

## Deliverables

- New migration file for area backfill and default `"A"` creation
- New migration file to enforce non-null `tables.area_id`
- Backend response changes for table area metadata
- Frontend `Table` type changes
- `TableFilterMenu` grouping refactor
- Theme refactor for the 360 dropdown and related overlays

## Open Question To Resolve During Implementation

Does product truly need `areas.table_id`, or is the correct model still:

- `areas.club_id`
- `tables.area_id`

Unless proven otherwise during implementation, prefer the second model.
