# 2026-05-14: Fix area booking per tavoli club-level

**Branch**: `claude/fix-booking-purchase-q6AWL`
**Status**: Done — fix sul backend.

---

## Overview

Dall'app mobile, premendo "Prenota area" su un evento e selezionando
un'area nel viewer 360°, l'utente riceveva sempre l'alert
**"Area non disponibile — Nessun tavolo disponibile per questa area"**
(HTTP 409) anche quando l'area conteneva tavoli liberi.

Causa: la query `find_first_available_table_by_area` in
`rust_BE/src/infrastructure/repositories/table_persistence.rs` filtrava
con `t.event_id = $2`, escludendo i tavoli club-level (tavoli con
`event_id IS NULL` introdotti dalla migrazione `044_club_level_tables.sql`).

Le sister-query nello stesso file
(`get_tables_by_event_id`, `get_available_tables_by_event_id`) erano già
state aggiornate per coprire entrambi i casi
(`event_id = $1 OR (event_id IS NULL AND area.club_id = event.club_id)`),
e anche il backfill della migrazione `046` segue la stessa logica.
`find_first_available_table_by_area` era l'unico punto disallineato:
il mobile vedeva l'area come prenotabile (perché `/tables/event/:id`
includeva i tavoli club-level), ma il booking falliva con 409 al
backend.

---

## Backend

### `rust_BE/src/infrastructure/repositories/table_persistence.rs`

- `find_first_available_table_by_area`: WHERE clause estesa per
  ammettere sia tavoli event-bound (`t.event_id = $2`) sia tavoli
  club-level (`t.event_id IS NULL` con `a.club_id = e.club_id`),
  via un nuovo `JOIN events e ON e.id = $2`.
- Doc-comment aggiornato per spiegare la ragione della UNION logica
  e il legame con la migrazione 044.
- Firma del metodo invariata: i due call site nel
  `table_controller.rs` (`create_payment_intent` e
  `create_reservation_with_payment`) non richiedono modifiche.

---

## Files Modified

| File | Cambiamento |
|---|---|
| `rust_BE/src/infrastructure/repositories/table_persistence.rs` | Estesa la WHERE di `find_first_available_table_by_area` per includere i tavoli club-level (`event_id IS NULL`, area dello stesso club). |

---

## Note (out of scope)

`find_first_available_table_by_area` è ancora chiamata senza lock anche
da `create_reservation_with_payment` (controller:809) — il commento
inline ("no lock — for pricing preview only") andrà rivisto e la query
spostata sotto `SELECT ... FOR UPDATE SKIP LOCKED` dentro una
transazione, oppure protetta da advisory lock per `(event_id, area_id)`.
Non incluso in questa PR per restare focalizzati sul ripristino della
funzionalità.
