# 2026-05-05: Fallback Marzipano del club applicato ovunque

**Branch**: `fix/event-marzipano-club-fallback-everywhere`
**Status**: Done — `cargo check` ✅

---

## Overview

L'app mobile mostrava "Tour 360° non disponibile" anche per eventi il cui club
ha `marzipano_config` configurato. Causa: il fallback evento → club era
applicato solo in `GET /events/:id`, mentre la home apre il modale di
prenotazione tavolo a partire dall'evento ricevuto da `GET /events` (lista),
dove il fallback non scattava mai. Stesso buco su `POST/PUT /events`,
`POST/PUT /owner/events` e `GET /owner/events`.

Estesa la logica di fallback a tutti i punti che restituiscono `EventResponse`,
con un batch fetch per la lista che evita N+1.

Inoltre, su staging sono stati rimossi 30 eventi seed con `club_id IS NULL`
(per quelli il fallback non sarebbe comunque possibile), insieme alle righe
collegate (1 reservation, 8 ticket, 45 tavoli). Tabelle figlie come
`reservation_payment_shares`, `reservation_guests`, `table_images` sono state
ripulite via CASCADE.

---

## Changes

### Backend

- **`rust_BE/src/infrastructure/repositories/club_persistence.rs`** —
  nuovo `get_marzipano_configs_for_clubs(pool, &[Uuid])`: batch fetch dei
  `marzipano_config` non-null per un set di club id, in una singola query
  `WHERE id = ANY($1)`. Restituisce `HashMap<Uuid, JsonValue>`.

- **`rust_BE/src/controllers/event_controller.rs`** —
  - `event_response_with_club_fallback` reso `pub(crate)` per riuso.
  - Nuovo `event_responses_with_club_fallback` (batch): raccoglie i club id
    distinti degli eventi senza `marzipano_config`, fa una sola query, applica
    il fallback. In caso di errore DB serve la lista senza fallback (logga
    `warn!`, non 500: enrichment non essenziale).
  - `get_all_events`, `create_event`, `update_event` ora applicano il fallback.
  - `get_event` continuava già ad applicarlo.

- **`rust_BE/src/controllers/club_owner_controller.rs`** — fallback applicato
  in `get_my_club_events` (batch), `create_club_event` (singolo),
  `update_club_event` (singolo), riusando gli helper di `event_controller`.

### Database (staging only — niente migration)

Una-tantum su Supabase staging:

```sql
DO $$
DECLARE orphan_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO orphan_ids FROM events WHERE club_id IS NULL;
  DELETE FROM table_reservations WHERE event_id = ANY(orphan_ids);
  DELETE FROM tickets             WHERE event_id = ANY(orphan_ids);
  DELETE FROM tables              WHERE event_id = ANY(orphan_ids);
  DELETE FROM events              WHERE id       = ANY(orphan_ids);
END $$;
```

Stato pre/post:

| Metrica | Prima | Dopo |
|---|---|---|
| `events` totali | 33 | 3 |
| `events` con `club_id IS NULL` | 30 | 0 |
| `events` con `marzipano_config` | 2 | 1 |
| `clubs` con `marzipano_config` | 2 | 2 |

I 3 eventi rimanenti ("🌸 1 Maggio🌺", "AAAAA", "Prezioso") hanno tutti un
club associato e il tour ora è visibile in app:
- "🌸 1 Maggio🌺" via `marzipano_config` proprio,
- "AAAAA" e "Prezioso" via fallback dal club.

---

## Endpoint coverage

| Handler | Tipo | Endpoint | Stato |
|---|---|---|---|
| `get_all_events` | batch | `GET /events` | ✅ ora applica |
| `get_event` | singolo | `GET /events/:id` | ✅ già applicava |
| `create_event` | singolo | `POST /events` | ✅ ora applica |
| `update_event` | singolo | `PUT /events/:id` | ✅ ora applica |
| `get_my_club_events` | batch | `GET /owner/events` | ✅ ora applica |
| `create_club_event` | singolo | `POST /owner/events` | ✅ ora applica |
| `update_club_event` | singolo | `PUT /owner/events/:id` | ✅ ora applica |

---

## Files Modified

| File | Modifica |
|---|---|
| `rust_BE/src/infrastructure/repositories/club_persistence.rs` | + `get_marzipano_configs_for_clubs` batch helper |
| `rust_BE/src/controllers/event_controller.rs` | + `event_responses_with_club_fallback` batch helper; fallback applicato in list/create/update |
| `rust_BE/src/controllers/club_owner_controller.rs` | fallback applicato nei 3 handler owner riusando gli helper |

---

## Follow-up

- Aprire issue per un job "garbage collector" che ripulisca periodicamente
  entità orfane (event senza club, table_images senza table, panorami su
  storage senza scena referenziata, ecc.) per evitare derive simili in futuro.
