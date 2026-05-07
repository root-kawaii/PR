# 2026-05-07: Area-first reservation end-to-end (#61)

**Branch**: `claude/fix-table-hotspot-booking-xypWm`
**Status**: Done — modifiche solo lato app mobile (BE già pronto in `73df1f5`).
**Issues**: chiude #61, build-on di #52 e #54 (chiuse ieri).

---

## Overview

Dopo PR #60 la mobile aveva la card popup per gli hotspot area, ma chiamava
ancora il backend con `table_id` (scelto localmente con `tables.find(...)`) —
quindi l'auto-assegnazione atomica `FOR UPDATE` lato BE non veniva sfruttata,
e due client potevano pickare lo stesso tavolo concorrentemente. Inoltre il
counter "N/M tavoli liberi" non si aggiornava dopo una prenotazione: serviva
chiudere e riaprire il modal.

Questa PR chiude il giro:

- mobile invia `area_id` (non più `table_id`) sia a
  `/reservations/create-payment-intent` sia a `/reservations/create-with-payment`
- gestisce esplicitamente il caso 409 "Nessun tavolo disponibile per questa
  area" prima di aprire lo Stripe Sheet
- al successo della prenotazione rifa il fetch dei tavoli, e il
  `MarzipanoViewer` aggiorna live i contatori delle card area via il path
  `syncMarzipanoViewer` esistente

---

## Mobile

### `pierre_two/components/reservation/TableReservationModal.tsx`

- Nuovi prop opzionali: `areaId?: string` e `onReservationCreated?: () => void`.
- Le due chiamate `fetch` ora costruiscono il body in modo condizionale:
  - se `areaId` è presente → body include `area_id`, NON `table_id`
  - altrimenti fallback al vecchio comportamento con `table_id`
- Il prop `table` resta come "rappresentante" dell'area solo per la UI
  (prezzo, capienza, features, location label nello Share). Il suo `id` non
  viaggia più sul filo come identificatore della prenotazione.
- Nuovo branch sul `paymentIntentResponse.status === 409`: `Alert` con il
  messaggio italiano del BE ("Nessun tavolo disponibile per questa area"),
  poi `onReservationCreated?.()` (per refetch) + `onClose()` — l'utente NON
  arriva allo Stripe Sheet su un'area piena.
- `onReservationCreated?.()` viene anche invocato sul ramo di successo,
  appena prima di `onClose()`.

### `pierre_two/components/event/TableReservationModal.tsx`

- Nuovo state `selectedAreaId` accanto a `selectedTable`. `handleAreaClick`
  setta entrambi: `selectedTable` come rappresentante per la UI,
  `selectedAreaId` per il routing BE.
- `<PaymentModal>` riceve ora `areaId={selectedAreaId ?? undefined}` e
  `onReservationCreated={fetchTables}`. Nessun cambiamento ai display props.
- Reset di `selectedAreaId` su modal close.

### Live update dei contatori area

Nessun nuovo codice servito: `fetchTables` aggiorna lo state `tables` →
`MarzipanoViewer.buildViewerConfig` (già `useCallback` con `[scenes, tables]`)
ricalcola `availableCount/totalCount` per ogni area → l'effetto che chiama
`window.syncMarzipanoViewer` parte e in `viewer.html` `clearHotspots()` +
`createHotspots()` ricostruisce le card con i numeri freschi. Il path era
già pronto, mancava solo qualcuno che innescasse `fetchTables` dopo il
successo del pagamento.

---

## Backend (no changes)

Già in `73df1f5`:

- `CreateSplitPaymentIntentRequest` / `CreateSplitReservationRequest` accettano
  `area_id: Option<String>`.
- `find_first_available_table_by_area` (no lock — pricing preview).
- Inside `create_reservation_with_payment` la transazione fa
  `SELECT id FROM tables WHERE id = $1 AND available = true FOR UPDATE`
  → se nel mentre qualcun altro l'ha bloccato, ritorna 409
  "Tavolo non più disponibile". Doppia prenotazione concorrente: una passa,
  l'altra riceve 409 strutturato.

---

## Files Modified

| File | Note |
|---|---|
| `pierre_two/components/reservation/TableReservationModal.tsx` | Send area_id, handle 409, onReservationCreated |
| `pierre_two/components/event/TableReservationModal.tsx` | Plumb selectedAreaId + fetchTables on success |
| `docs/daily-progress/2026-05-07-area-first-end-to-end.md` | Questo log |

---

## Test plan manuale

- [ ] Prenotazione su area con tavoli liberi: card si aggiorna a `N-1/M`
      senza chiudere e riaprire il modal.
- [ ] Prenotazione su ultimo tavolo dell'area: card passa a "Non disponibile"
      al ritorno dal pagamento (refetch).
- [ ] Tap area piena (es. lista stale): `Alert` "Area non disponibile…"
      prima di aprire lo Stripe Sheet, niente authorization hold inutile.
- [ ] Cancellazione lato dashboard: alla riapertura del modal il counter
      torna a `N+1/M`.
- [ ] Concorrenza: 2 device prenotano l'ultimo tavolo della stessa area
      → solo uno passa, l'altro riceve l'errore italiano del BE.
