# 2026-05-14: Fix area booking — tavoli club-level + landing post-pagamento

**Branch**: `claude/fix-booking-purchase-q6AWL`
**Status**: Done — backend (query area→tavolo) + mobile (landing post-pagamento).

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

## Mobile

### Black screen dopo pagamento — landing su `/reservations`

Sintomo: dopo aver completato lo Stripe PaymentSheet, l'utente restava
su una schermata nera e doveva chiudere/riaprire l'app.

Causa: nella stessa render-tick il flusso di successo chiudeva 3
modali nestate (`EventDetailModal` → `event/TableReservationModal`
con `presentationStyle="fullScreen"` + sfondo nero →
`reservation/TableReservationModal`) **e** apriva una quarta modale
(`TableReservationDetailModal` sulla home). iOS non gestisce un
present mentre più dismiss sono ancora in corso → una delle modali
resta "appesa" come overlay nero.

Fix: invece di aprire la detail-modal sulla home, navighiamo al tab
`/reservations` (path file-based di Expo Router) passando il
`reservation_id` come param. Il tab `reservations` legge il param e
apre la detail-modal solo dopo che la lista è stata caricata, poi
pulisce il param via `router.setParams`. Coerente anche con
l'aspettativa utente di "atterrare nella pagina della reservation".

- `pierre_two/app/(tabs)/index.tsx`
  - `EventDetailModal.onReservationCreated` ora chiama
    `router.push({ pathname: "/(tabs)/reservations",
    params: { reservation_id: reservation.id } })` invece di
    `setSelectedReservation`.
  - Rimossi: import di `TableReservationDetailModal`, lo state
    `selectedReservation`, e il render della detail-modal sulla home
    (codice morto dopo il refactor).
- `pierre_two/app/(tabs)/reservations.tsx`
  - Legge `reservation_id` da `useLocalSearchParams`.
  - Nuovo `useEffect` che, quando il param matcha una reservation
    della lista, apre la detail-modal e pulisce il param.

---

## Files Modified

| File | Cambiamento |
|---|---|
| `rust_BE/src/infrastructure/repositories/table_persistence.rs` | Estesa la WHERE di `find_first_available_table_by_area` per includere i tavoli club-level (`event_id IS NULL`, area dello stesso club). |
| `pierre_two/app/(tabs)/index.tsx` | Sostituita l'apertura della detail-modal locale con `router.push("/(tabs)/reservations?reservation_id=…")`; rimosso codice morto. |
| `pierre_two/app/(tabs)/reservations.tsx` | Auto-apertura della detail-modal in base al param `reservation_id` arrivato dalla home. |

---

## Note (out of scope)

`find_first_available_table_by_area` è ancora chiamata senza lock anche
da `create_reservation_with_payment` (controller:809) — il commento
inline ("no lock — for pricing preview only") andrà rivisto e la query
spostata sotto `SELECT ... FOR UPDATE SKIP LOCKED` dentro una
transazione, oppure protetta da advisory lock per `(event_id, area_id)`.
Non incluso in questa PR per restare focalizzati sul ripristino della
funzionalità.
