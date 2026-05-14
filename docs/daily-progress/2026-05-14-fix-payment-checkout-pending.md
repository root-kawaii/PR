# 2026-05-14: Fix split-payment — share bloccati in `checkout_pending`

**Branch**: `claude/fix-payment-checkout-pending-e8lQj`
**Status**: Done — webhook fallback + back-fill + idempotenza + migration di
reconciliation.

---

## Overview

Quando un ospite pagava la propria quota via `/payment-links/:token`, lo
share in `reservation_payment_shares` poteva restare per sempre in
`status='checkout_pending'`, e il contatore `num_people` su
`table_reservations` non veniva mai incrementato — pur con il pagamento
effettivamente incassato su Stripe.

La causa è che la creazione dello share avviene in due fasi non atomiche
(`rust_BE/src/controllers/table_controller.rs:1349-1492`):

1. INSERT con `status='checkout_pending'` e
   `stripe_checkout_session_id=NULL` → tx committata.
2. Creazione della Stripe Checkout Session.
3. UPDATE post-commit che scrive `stripe_checkout_session_id` sulla riga.

Se lo step 3 falliva o arrivava dopo il webhook, il webhook a
`controllers/webhook_controller.rs:392-415` cercava lo share
**solo** per `stripe_checkout_session_id` e ritornava 200 OK silenzioso
("may be external"). Aggravante: l'evento veniva marcato come processato
*prima* dell'handler, quindi i retry di Stripe venivano scartati dal dedup
e lo share restava intrappolato.

Buona notizia: la Stripe Checkout Session porta già `payment_share_id` e
`reservation_id` nei `metadata` (`table_controller.rs:1428-1435`), quindi è
disponibile un percorso di lookup di fallback affidabile.

---

## Backend

### `rust_BE/src/infrastructure/repositories/table_persistence.rs`

- Aggiunto `get_payment_share_by_id(pool, share_id)` accanto a
  `get_payment_share_by_checkout_session`, usato dal webhook come
  fallback quando il lookup per `stripe_checkout_session_id` fallisce.

### `rust_BE/src/controllers/webhook_controller.rs`

- `handle_checkout_session_completed`: se il lookup per
  `stripe_checkout_session_id` ritorna `RowNotFound`, ora viene estratto
  `metadata.payment_share_id` dalla session e si fa fallback a
  `get_payment_share_by_id`. Lo share risolto via fallback viene
  back-fillato (`stripe_checkout_session_id = COALESCE(..., $)`) dentro la
  stessa transazione che marca lo share `paid`, così retry futuri trovano
  la riga senza fallback.
- Dedup `processed_stripe_events`: l'INSERT è stato spostato **dopo** il
  match degli handler ed eseguito solo se `result == 200`. Se un handler
  fallisce (es. errore DB), l'evento non viene marcato come processato e
  Stripe può ritentare. La protezione contro doppio-incremento di
  `num_people` su retry concorrenti è garantita dallo short-circuit
  applicativo `if share.status == "paid"` già esistente.

---

## Database

### `DB/migrations/050_reconcile_stuck_payment_shares.sql` (nuova)

- Auto-expire degli share `checkout_pending` con
  `stripe_checkout_session_id IS NULL` più vecchi di 24h (mai realmente
  arrivati su Stripe).
- View `v_stuck_payment_shares` con tutto il contesto necessario
  all'operatore per riconciliare manualmente gli share `checkout_pending`
  che hanno una `stripe_checkout_session_id` valida (per quelli serve
  controllare su Stripe se il PaymentIntent è `succeeded`, poi
  `DELETE FROM processed_stripe_events WHERE stripe_event_id = '<id>'` e
  `stripe events resend <evt>` — il webhook ora completerà il lavoro
  grazie al fallback metadata).

---

## Files Modified

| File | Change |
|---|---|
| `rust_BE/src/infrastructure/repositories/table_persistence.rs` | Aggiunto `get_payment_share_by_id` |
| `rust_BE/src/controllers/webhook_controller.rs` | Fallback metadata + back-fill + dedup post-success |
| `DB/migrations/050_reconcile_stuck_payment_shares.sql` | Migration nuova: auto-expire + view |
