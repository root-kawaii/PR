# 2026-05-14: Fix booking modal cascade — schermata vuota dopo Stripe

**Branch**: `claude/fix-booking-modal-cascade`
**Status**: Done — fix lato mobile.

---

## Overview

Dopo il merge di #75 il booking creava correttamente la reservation
(visibile su Supabase) ma alla chiusura dello Stripe PaymentSheet
l'utente atterrava su una schermata vuota e doveva killare la app
per recuperarla.

Causa: anche dopo aver tolto la quarta modale dalla home (#75), il
flusso di successo continuava a chiudere **tre** RN `<Modal>` nestate
(`EventDetailModal` → `event/TableReservationModal` con
`presentationStyle="fullScreen"` + sfondo nero →
`reservation/TableReservationModal`) impostando `visible=false` su
tutte e tre nello stesso render tick. iOS non gestisce bene tre
`dismissViewController` simultanee su modali nestate: uno dei view
controller resta "appeso" e copre la nuova schermata
(`/reservations`).

Fix: serializzare la cascata di dismiss. Ogni layer chiude **solo la
propria** modale (`onClose()`) e poi bubble-uppa al genitore dopo
350 ms — il tempo che iOS impiega a completare l'animazione di slide
prima che il livello successivo cominci la propria.

Tempistica totale: ~1050 ms tra la chiusura dello Stripe sheet e la
navigazione finale al tab `/reservations`. Più lento, ma corretto e
visivamente fluido (slide-down successive invece di un blackscreen).

---

## Mobile

### `pierre_two/components/reservation/TableReservationModal.tsx`

Sostituito

```ts
onReservationCreated?.(reservationForDetail);
onClose();
```

con

```ts
onClose();
setTimeout(() => {
  onReservationCreated?.(reservationForDetail);
}, 350);
```

La modale interna si chiude per prima; solo dopo l'animazione di
dismiss propaga il risultato al genitore.

### `pierre_two/components/event/TableReservationModal.tsx`

Nel callback `onReservationCreated` passato a `<PaymentModal>` —
stesso pattern: dopo `onClose()` (che chiude il modale full-screen
360°) attendo 350 ms prima di chiamare `onReservationCreated` del
genitore.

### `pierre_two/components/event/EventDetailModal.tsx`

Nel callback `onReservationCreated` passato a `<TableReservationModal>`
(versione `event/`) — stesso pattern. L'ultimo bubble-up arriva
all'`HomeScreen` quando l'`EventDetailModal` è già completamente
dismessa, quindi `router.push("/(tabs)/reservations?reservation_id=…")`
naviga senza nessun view controller residuo sopra.

---

## Files Modified

| File | Cambiamento |
|---|---|
| `pierre_two/components/reservation/TableReservationModal.tsx` | `setTimeout(350)` tra `onClose()` e il bubble-up `onReservationCreated`. |
| `pierre_two/components/event/TableReservationModal.tsx` | Stessa serializzazione nel callback passato a `<PaymentModal>`. |
| `pierre_two/components/event/EventDetailModal.tsx` | Stessa serializzazione nel callback passato al `<TableReservationModal>` interno. |

---

## Note

- Il delay totale di ~1050 ms è la somma necessaria per far chiudere
  le tre modali in sequenza senza far racing iOS. In futuro si può
  passare a `Modal.onDismiss` (iOS-only, RN ≥0.71) per scattare il
  bubble-up esattamente alla fine dell'animazione invece di un
  setTimeout fisso — UX leggermente più reattiva, codice più
  complesso (serve fallback Android).
- L'endpoint `GET /reservations/user/:user_id` legge da
  `state.read_db_pool` (controller:266). In ambienti dove
  `DATABASE_READ_URL` punta a un read replica, la nuova reservation
  potrebbe non essere ancora propagata quando il tab `/reservations`
  fa il fetch. Su staging/dev il `read_db_pool` fall-back è il write
  pool (`bootstrap/mod.rs:29-32`), quindi non è un problema; ma su
  prod con replica vera potrebbe servire un retry leggero o leggere
  dal write pool per questa rotta. Da valutare se si manifesta.
