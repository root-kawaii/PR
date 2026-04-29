# 2026-04-28: Rebase branch 360° tour su main

**Branch**: `claude/add-360-view-configurator-3fVkt`
**Status**: Done — `cargo check` ✅, `npm run build` ✅, force-pushed

---

## Overview

Il branch era divergito di ~50 commit rispetto a `main` (merge da staging,
rimozione Netlify/Vercel CI, fix vari). Prima di aggiornare la PR è stato
eseguito `git rebase origin/main` e risolti 6 conflitti.

---

## Conflitti risolti

| File | Strategia |
|---|---|
| `rust_BE/src/api/routers/owner.rs` | Uniti import: mantenuti handler esistenti (`update_club_event`, `delete_club_event`, `upload_event_image`) + nuovi Marzipano |
| `rust_BE/src/bootstrap/config.rs` | `StorageConfig` unificato: `event_images_bucket` (esistente) + `panoramas_bucket` + `max_panorama_bytes`; rinominato `service_role_key` → `supabase_service_role_key` |
| `rust_BE/src/services/storage_service.rs` | File `add/add`: tenuta la funzione standalone `upload_event_image` (usata da `event_image_controller`) accanto al nuovo `StorageService` struct per i panorami |
| `rust_BE/src/infrastructure/repositories/event_persistence.rs` | Import uniti (`GenreResponse`, `NaiveDate`, `HashMap`, `QueryBuilder` da main + `serde_json::Value` dal branch) |
| `rust_BE/src/controllers/event_controller.rs` | Import uniti; `get_event` usa `event_response_with_club_fallback` + fetcha comunque i genres |
| `pierre_two/components/event/MarzipanoViewer.tsx` | Aggiunto `areaId`/`areaName` nel `buildViewerConfig` di main; preservato il sync `useEffect` |

### Fix derivanti dal rebase

- `rust_BE/src/controllers/event_image_controller.rs` — aggiornato il campo
  `storage.service_role_key` → `storage.supabase_service_role_key` per
  allinearlo al rename in `StorageConfig`.

---

## Files Modified

| File | Modifica |
|---|---|
| `rust_BE/src/api/routers/owner.rs` | Conflitto import risolto |
| `rust_BE/src/bootstrap/config.rs` | `StorageConfig` unificato (2 bucket) |
| `rust_BE/src/services/storage_service.rs` | Merge funzione legacy + struct nuovo |
| `rust_BE/src/infrastructure/repositories/event_persistence.rs` | Import uniti |
| `rust_BE/src/controllers/event_controller.rs` | Import + logica `get_event` |
| `rust_BE/src/controllers/event_image_controller.rs` | Fix field rename |
| `pierre_two/components/event/MarzipanoViewer.tsx` | Area hotspot + sync effect |
| `pierre_dashboard/src/types/index.ts` | `marzipanoScenes` tipato + `genres` |
