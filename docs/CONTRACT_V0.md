# Pierre v0 — Contract

**Status**: Active development
**Last Updated**: 2026-05-06

---

## Team

| Member    | Role     | Focus                                      |
| --------- | -------- | ------------------------------------------ |
| **Vale**  | Dev      | `pierre_dashboard` (web), flexible         |
| **Regge** | Dev      | `pierre_two` (mobile), `rust_BE`, flexible |
| **Matte** | Business | Product, vendor relations                  |
| **Ale**   | Business | Product, vendor relations                  |

---

## Overview

This document tracks v0 requirements for Pierre across packages:

- `pierre_two` (React Native mobile)
- `pierre_dashboard` (React + Vite web)
- `rust_BE` (Axum backend)
- `DB` (PostgreSQL on Supabase)

Each requirement below is mapped 1:1 to a GitHub issue. Items already done in previous sprints are kept as a "Done" appendix for traceability.

---

## Issue index

| ID | Title                                                          | Priority | Packages              |
| -- | -------------------------------------------------------------- | -------- | --------------------- |
| A  | feat(dashboard): club-level areas & tables management          | high     | dashboard, backend, db |
| F  | feat(app): area-based reservation flow with auto table assign  | high     | mobile, backend        |
| G  | fix(app): area "minimum per person" and capacity counter sync   | high     | mobile, backend        |
| H  | fix(app): reservation blocks first available table in area     | high     | mobile, backend        |
| I  | fix(app): "Show QR" CTA broken/missing on ticket & reservation | high     | mobile                 |
| C  | feat(stats): expected incomes & extended event statistics       | medium   | dashboard, backend     |
| E  | feat(reservations): formal state machine for reservation status | medium   | backend, db, dashboard |
| B  | refactor: soft-deprecate table-level photos & "prenotazioni"   | low      | dashboard, backend     |
| D  | feat(reservations): audit log for reservation changes          | low      | dashboard, backend, db |
| J  | feat(app): improve scene navigation in Marzipano 360° viewer   | low      | mobile                 |

Priority legend: `high` = must ship in v0 / blocker. `medium` = ship in v0 if time. `low` = backlog.

---

## Requirements

### A — feat(dashboard): club-level areas & tables management

**Priority**: high
**Labels**: `area:dashboard`, `area:backend`, `area:db`, `type:feat`, `priority:high`
**Owner**: Vale
**Closes**: 0.1 (phase 1)

**Description**

Today tables are managed per-event under `EventTablesPage` (`/dashboard/events/:id/tables`). We move table management to the **club level**: areas and tables are configured once for the club, and every event reuses them. Clicking an event card should now go directly to its reservations page.

**Acceptance criteria**

- [ ] New page reachable from the main dashboard nav (e.g. `/dashboard/club/areas`) listing areas of the current club.
- [ ] Owner can create/rename/delete an area (name, optional min spend per person, optional capacity).
- [ ] Owner can create/rename/delete a table inside an area (name, capacity).
- [ ] `EventsPage` event card click → navigates to `/dashboard/events/:id/reservations` (not `/tables`).
- [ ] `EventTablesPage` route is removed from `pierre_dashboard` and corresponding nav links updated.
- [ ] Backend: `GET/POST/PATCH/DELETE /owner/areas`, `GET/POST/PATCH/DELETE /owner/tables` (scoped to authenticated club owner).
- [ ] DB migration: new `areas` table, `tables` gains `area_id` FK, drop the per-event coupling on `tables` (or backfill area from current data).
- [ ] All existing reservations remain valid after the migration (`table_id` stays unchanged; tables now belong to areas instead of events).

**Test plan**

- [ ] Manual: create 2 areas with 3 tables each, verify they appear when creating a new event.
- [ ] Manual: rename an area, verify reservations still resolve.
- [ ] Manual: delete a table that has no reservation → succeeds; delete a table with reservations → blocked with clear error.
- [ ] Backend tests: CRUD endpoints covered, auth scope enforced.
- [ ] Migration dry-run on a Supabase branch with a copy of prod data.

**Out of scope (phase 2)**

- Per-event override of capacity / availability of areas and tables.

---

### B — refactor: soft-deprecate table-level photos & "prenotazioni" action

**Priority**: low
**Labels**: `area:dashboard`, `area:backend`, `type:refactor`, `priority:low`
**Owner**: Regge
**Closes**: 0.2

**Description**

Photos and the "prenotazioni" action currently exposed at the **table** level are being removed. Photos belong at club / event level only. This is a soft deprecation: hide UI and API surface, keep DB columns intact for now (no data loss).

**Acceptance criteria**

- [ ] Dashboard: hide all UI controls for photos on tables and the table-level "prenotazioni" action.
- [ ] Backend: mark table-photo endpoints as deprecated (return `410 Gone` or remove from router) — keep DB columns.
- [ ] DB columns are left in place; a follow-up issue (phase 2) will hard-drop them once we are sure nothing reads them.
- [ ] No mobile-app surface affected (tables aren't selected by users — see F).

**Test plan**

- [ ] Manual: confirm dashboard no longer renders any table-photo UI.
- [ ] Manual: hit deprecated endpoints → expected error.
- [ ] Grep `pierre_dashboard/src` and `rust_BE/src` for "table_photo" references → none in active code paths.

---

### C — feat(stats): expected incomes & extended event statistics

**Priority**: medium
**Labels**: `area:dashboard`, `area:backend`, `type:feat`, `priority:medium`
**Owner**: TBD
**Closes**: 0.3 (residual)

**Description**

Extend `GET /owner/events/:id/stats` (M/F counts already shipped in commit `ad198c6`) with **expected incomes** and additional statistics to be defined with the business team.

**Acceptance criteria**

- [ ] Definition of "expected income" agreed with business and recorded in this issue (formula + which reservation states are counted).
- [ ] Backend: `/owner/events/:id/stats` returns `expectedIncome` (currency + value).
- [ ] Dashboard: new widget on `EventReservationsPage` next to the M/F card.
- [ ] Additional stats list closed (or explicitly deferred) before merge.

**Test plan**

- [ ] Backend test: stats endpoint returns expected value on a known seed.
- [ ] Manual: widget renders correctly with 0/some/many reservations.

**Open questions**

- Formula for `expectedIncome` (TBD with Matte/Ale).
- Other statistics requested by business (TBD).

---

### D — feat(reservations): audit log for reservation changes

**Priority**: low
**Labels**: `area:dashboard`, `area:backend`, `area:db`, `type:feat`, `priority:low`
**Owner**: Regge
**Closes**: 0.4 (residual — audit log only, modal already shipped)

**Description**

Track every modification to a reservation (who changed what, and when). Used for accountability between owner and staff and to debug discrepancies.

**Acceptance criteria**

- [ ] New table `reservation_audit_log` (`id`, `reservation_id`, `actor_user_id`, `field`, `old_value`, `new_value`, `created_at`).
- [ ] `PATCH /owner/reservations/:id` writes one row per changed field in the same transaction.
- [ ] Dashboard: collapsible "history" section in the reservation modal showing the log entries.
- [ ] Read endpoint `GET /owner/reservations/:id/audit` for the dashboard.

**Test plan**

- [ ] Backend test: PATCH with multiple field changes produces the expected number of log rows.
- [ ] Manual: edit a reservation in the dashboard → history shows new entries with correct user and timestamps.

---

### E — feat(reservations): formal state machine for reservation status

**Priority**: medium
**Labels**: `area:backend`, `area:db`, `area:dashboard`, `type:feat`, `priority:medium`
**Owner**: Regge
**Closes**: 0.5 (residual)

**Description**

Today reservation status is partially modeled. We formalize the lifecycle as a state machine, with allowed transitions, refusal reason, and timestamps for each transition. Push notifications and the QR refuse button are already in place (commit `ad198c6`).

States:

1. `in_attesa` — minimum number not reached
2. `prenotato` — minimum reached
3. `accesso_effettuato` — QR scanned & accepted at the door
4. `accesso_rifiutato` — QR scanned but bouncer refused entry (optional `refusal_reason`)
5. `cancellato` — cancelled by user or owner

**Acceptance criteria**

- [ ] DB enum `reservation_status` with the five states above.
- [ ] DB column `refusal_reason TEXT NULL`.
- [ ] DB columns or separate table for transition timestamps (decision recorded in the PR).
- [ ] Backend: helper that validates allowed transitions; invalid ones return `409` with Italian message.
- [ ] Dashboard: status dropdown in the reservation modal only offers valid next states.
- [ ] Documented allowed-transitions table in `docs/`.

**Test plan**

- [ ] Backend tests for every valid and invalid transition.
- [ ] Manual: from each state, confirm dashboard offers exactly the expected options.

---

### F — feat(app): area-based reservation flow with auto table assignment

**Priority**: high
**Labels**: `area:mobile`, `area:backend`, `type:feat`, `priority:high`
**Owner**: Regge
**Closes**: 0.6

**Description**

Resolution of open point 0.6: in the mobile app the customer **picks an area only** — never a specific table. The backend assigns the first available table in that area at reservation time. The dashboard owner retains manual table reassignment (already shipped in 0.4.1).

**Acceptance criteria**

- [ ] Mobile reservation flow shows a list of areas (with min spend per person + remaining capacity), no table selection.
- [ ] Reservation creation endpoint accepts `area_id` and assigns the first free table inside that area atomically (no race on concurrent requests).
- [ ] If no table is free in the area, return a clear error and the app shows it gracefully.
- [ ] Dashboard owner can still reassign the table manually (existing behavior preserved).

**Test plan**

- [ ] Manual: 2 concurrent reservations on the last free table in an area → only one succeeds.
- [ ] Manual: full flow on a real iOS / Android device.

---

### G — fix(app): area "minimum per person" and capacity counter sync

**Priority**: high
**Labels**: `area:mobile`, `area:backend`, `type:bug`, `priority:high`
**Owner**: Regge

**Description**

In the app menu "aree disponibili", the *min spend per person* and *people available per area* are not aligned with what the dashboard shows. Source of truth must be the same.

**Acceptance criteria**

- [ ] Same value for "min per person" in dashboard and app for the same area.
- [ ] "People available" counter in the app matches the dashboard's view.
- [ ] Single source of truth identified and documented (likely the `areas` table from issue A).

**Test plan**

- [ ] Manual: change min spend in dashboard → app reflects change after refresh.
- [ ] Manual: book a table → app's "people available" decreases consistently with dashboard.

**Depends on**: issue A (areas as a club-level concept).

---

### H — fix(app): reservation blocks first available table in area (counter update)

**Priority**: high
**Labels**: `area:mobile`, `area:backend`, `type:bug`, `priority:high`
**Owner**: Regge

**Description**

Reservations created from the app should block the first available table in the selected area, but currently the counter visible in the app under "aree disponibili" does not update. Fix the write path and / or the read aggregation so both stay in sync.

**Acceptance criteria**

- [ ] After successful reservation, the app's "available people in area" counter decreases by the booked amount.
- [ ] Counter recovers if the reservation is later cancelled.
- [ ] No double-booking under concurrent requests (covered by F's atomic assignment, but verified here too).

**Test plan**

- [ ] Manual: book → counter decreases. Cancel → counter increases.
- [ ] Manual: try to overbook → blocked with clear error.

**Depends on**: issues A and F.

---

### I — fix(app): "Show QR" CTA broken on ticket, missing on table reservation

**Priority**: high
**Labels**: `area:mobile`, `type:bug`, `priority:high`
**Owner**: Regge

**Description**

Two distinct bugs in the mobile app:
1. The "Show QR code" CTA on a **ticket** is not clickable — it sits below the bottom navigation bar / is overlapped.
2. The same CTA is **completely missing** on a **table reservation**.

**Acceptance criteria**

- [ ] Ticket detail screen: CTA is fully visible above the tab bar and clickable.
- [ ] Table reservation detail screen: a "Show QR code" CTA exists and opens the QR view.
- [ ] Verified on iOS and Android, on at least one small-screen device.

**Test plan**

- [ ] Manual on iPhone SE-class device: CTA reachable on both ticket and reservation screens.
- [ ] Manual on Android phone: same.

---

### J — feat(app): improve scene navigation in Marzipano 360° viewer

**Priority**: low
**Labels**: `area:mobile`, `type:feat`, `priority:low`
**Owner**: Regge

**Description**

Polish the navigation between scenes in the 360° viewer (the recent crash on scene switch was already fixed on branch `fix/marzipano-viewer-scene-switch-crash`). UX details TBD.

**Acceptance criteria**

- [ ] Scope agreed (transition animation? mini-map? hotspot styling?) and listed in the issue.
- [ ] Implementation merged.

**Test plan**

- [ ] Manual: switch scenes repeatedly on a real device, no flicker / crash.

---

## Dependencies

```
A (areas/tables)  ──→ G, H, F
F (app area flow) ──→ H
E (state machine) ──→ D (audit log can use the same write path)

B, C, I, J : independent
```

---

## Done — appendix (kept for traceability)

The following items from the previous version of this contract have already shipped and are not tracked as open issues:

- **0.4 (modal + fields modifiable)** — `PATCH /owner/reservations/:id`, modal in dashboard with all fields, gender count validation. Audit log split out as issue **D**.
- **0.4.1 (easy table change)** — modal dropdown + inline change from reservation list.
- **0.5 (partial)** — "Refuse" button in QR scanner; push notifications on every state change. Formal state machine + `refusal_reason` + timestamps tracked as issue **E**.
- **0.7 (UI for reservation modify)** — single modal with all fields, in `EventReservationsPage` (commit `ad198c6`).
