# 2026-05-14: Fix safe area schermata Dettagli Prenotazione

**Branch**: `claude/fix-booking-safe-area-MZgI9`
**Status**: Done — fix solo mobile.

---

## Overview

`TableReservationDetailModal` (la schermata "Dettagli Prenotazione" aperta
dal tab Prenotazioni) presentava un comportamento incoerente al top:

- **Prima apertura**: header `Dettagli Prenotazione` sotto la Dynamic Island.
- **Aperture successive**: troppo spazio sopra l'header.

### Causa

La modale è un `<Modal>` di React Native senza `presentationStyle`
(quindi fullScreen), e al suo interno conviveva una doppia fonte di
verità per il padding superiore:

1. `<SafeAreaView edges={["top"]}>` di `react-native-safe-area-context`,
   il cui `top` inset viene letto dal `SafeAreaProvider` montato in
   `app/_layout.tsx`.
2. `styles.header` con `paddingTop: 28` hard-coded.

Senza `initialMetrics` sul `SafeAreaProvider`, alla prima resa gli
insets risultano `0` (la misurazione nativa non è ancora arrivata in JS).
Risultato:

- 1ª apertura → SafeAreaView aggiunge `0`, header parte a `28pt` →
  finisce sotto la Dynamic Island (~50pt).
- 2ª apertura → SafeAreaView aggiunge `~59pt` + i `28pt` hard-coded →
  `~87pt` di spazio sopra l'header.

Le altre modali (es. `EventDetailModal`) non mostravano il difetto
perché usano `presentationStyle="pageSheet"` (top inset interno = 0).

---

## Mobile

### Root layout

- `pierre_two/app/_layout.tsx`: `SafeAreaProvider` ora riceve
  `initialMetrics={initialWindowMetrics}`. Così gli insets sono
  disponibili **alla prima resa**, eliminando il flash con
  `inset = 0` su tutto l'albero (e in particolare dentro le `<Modal>`
  fullScreen).

### Schermata Dettagli Prenotazione

- `pierre_two/components/reservation/TableReservationDetailModal.tsx`:
  - Sostituito il wrapper `<SafeAreaView edges={["top"]}>` con un
    semplice `<View>`. Si elimina la doppia fonte di verità per il
    padding superiore.
  - Aggiunto `useSafeAreaInsets()`.
  - L'header riceve `paddingTop: insets.top + 8` inline, rimosso il
    `paddingTop: 28` hard-coded da `styles.header`.

Stesso pattern già usato per i pulsanti floating di
`components/event/TableReservationModal.tsx`
(cfr. `2026-05-14-fix-safe-area-mobile.md`).

---

## Out of scope

- Le altre modali full-screen (`event/TableReservationModal` tour 360°)
  e quelle in pageSheet (`EventDetailModal`, `TicketPurchaseModal`)
  non sono state toccate: non manifestano il difetto.
- Le tab screens continuano a gestire da sole il bottom inset tramite
  la custom tab bar.

---

## Files Modified

| File | Cambiamento |
|---|---|
| `pierre_two/app/_layout.tsx` | `SafeAreaProvider` riceve `initialMetrics={initialWindowMetrics}` — insets disponibili alla prima resa. |
| `pierre_two/components/reservation/TableReservationDetailModal.tsx` | Rimosso `SafeAreaView`, header con `paddingTop: insets.top + 8` via `useSafeAreaInsets()`. Rimosso `paddingTop: 28` hard-coded da `styles.header`. |
