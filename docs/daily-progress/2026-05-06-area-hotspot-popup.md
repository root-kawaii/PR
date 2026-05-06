# 2026-05-06: Popup hotspot area nel viewer 360° mobile

**Branch**: `claude/fix-table-hotspot-booking-xypWm`
**Status**: Done — modifiche solo lato app mobile.

---

## Overview

Dopo il refactor `73df1f5` (area-first booking) gli hotspot di tipo `area` nel
viewer 360° in app erano ridotti a un piccolo simbolo `◆`. Sul tap, il listener
React Native cercava un tavolo libero nell'area e apriva il `PaymentModal`, ma
se la `find` non trovava nulla il click moriva silenziosamente — l'utente
percepiva un hotspot "morto".

Riciclato il popup-card storico dell'hotspot tavolo (titolo, capienza, costo,
features, descrizione, bottone "Prenota Ora") adattandolo all'area, in modo che:

- l'utente vede subito le info dell'area direttamente nella vista 360°
- il bottone CTA dentro la card avvia il flusso di prenotazione (apre il
  `PaymentModal` esistente con il primo tavolo libero dell'area)
- se nessun tavolo è libero, la card mostra "Non disponibile" invece di
  fingere di essere cliccabile

---

## Mobile

### `pierre_two/components/event/MarzipanoViewer.tsx`

`buildViewerConfig` ora calcola, per ogni hotspot di tipo `area`, anche un
"tavolo rappresentativo" (primo libero, fallback al primo dell'area) e ne
inietta `capacity`, `totalCost`, `minSpend`, `features`, `locationDescription`,
`availableCount` e `totalCount` nella config passata al WebView. Necessario per
popolare la card dentro l'iframe Marzipano senza fetchare le aree dal backend.

### `pierre_two/assets/marzipano/viewer.html`

- CSS: `.hotspot.area` non è più un cerchietto 44x44. Ora replica la card
  delle vecchie `.hotspot.table` (min-width 200, max-width 280, sfondo scuro
  con blur, border verde se disponibile, grigio se no).
- `createHotspot` per `type === 'area'` costruisce ora la card con header
  (icona ✓/✕ + nome area), location description, dettagli (`👥` posti,
  `💳` totale, `🪑 N/M tavoli liberi`), feature tags e bottone
  `Prenota Ora` (verde) quando disponibile, oppure pill `Non disponibile`.
- `handleAreaClick` ha lo stesso debounce 500ms di `handleTableClick` per
  evitare doppio invio del messaggio `AREA_CLICK` su tap multipli.

### `pierre_two/components/event/TableReservationModal.tsx`

`handleAreaClick` mostra ora un `Alert` ("Area non disponibile…") nel ramo in
cui non viene trovato alcun tavolo libero, invece di un solo `console.log`.
È un branch difensivo: la card della UI nuova disabilita già il bottone in
quel caso, ma se la disponibilità cambia tra render e tap evitiamo il
"click muto".

---

## Files Modified

| File | Note |
|---|---|
| `pierre_two/assets/marzipano/viewer.html` | Card popup per hotspot area, debounce click |
| `pierre_two/components/event/MarzipanoViewer.tsx` | Inietta capacity/cost/features/availability nella config area |
| `pierre_two/components/event/TableReservationModal.tsx` | Alert su area senza tavoli liberi |
| `docs/daily-progress/2026-05-06-area-hotspot-popup.md` | Questo log |
