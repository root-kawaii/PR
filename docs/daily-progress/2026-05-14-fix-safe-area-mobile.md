# 2026-05-14: Fix safe area mobile (registrazione, login, modali)

**Branch**: `claude/fix-safe-area-registration-ozpmd`
**Status**: Done — fix solo mobile.

---

## Overview

L'app mobile non rispettava le safe area su diverse schermate: in
particolare la pagina di **registrazione** (`/register`) e quella di
**login** mostravano il wordmark "PIERRE" e la barra a step sotto il
notch / la Dynamic Island, perché entrambe le schermate usavano un
`KeyboardAvoidingView` come root senza alcun wrapper safe-area.

Audit completo (cfr. piano in `/root/.claude/plans/`): individuati
altri tre punti con difetti reali — la schermata `+not-found`, la
schermata modale generica `app/modal.tsx`, e il pulsante back del
tour 360° (`TableReservationModal`) che era posizionato con
`top: 60` hard-coded e quindi finiva sotto la Dynamic Island sui
device più recenti. Anche `ReservationCodeModal` (dialog centrato
trasparente) ricevuto un wrapper per evitare overlap su iPhone
landscape.

Le tab screens già funzionavano correttamente — la custom tab bar in
`app/(tabs)/_layout.tsx` legge `useSafeAreaInsets()` e gestisce il
bottom inset da sola; lì non serve toccare nulla.

---

## Mobile

### Root layout

- `pierre_two/app/_layout.tsx`: aggiunto `SafeAreaProvider` esplicito
  in cima alla gerarchia (subito dentro `RootLayout`). React Navigation
  ne forniva uno implicito, ma averlo esplicito rende disponibili gli
  inset anche durante lo splash `ActivityIndicator` prima che il
  navigator monti.

### Schermate

- `pierre_two/app/register.tsx`: entrambi i branch (`step === "info"` e
  `step === "phone-verification"`) ora sono wrappati in
  `<SafeAreaView edges={['top','bottom']}>` da
  `react-native-safe-area-context`, con il `KeyboardAvoidingView`
  spostato all'interno. Il wordmark "PIERRE" e la barra a step
  ora restano sotto la status bar.
- `pierre_two/app/login.tsx`: stesso pattern.
- `pierre_two/app/modal.tsx`: wrappato in `SafeAreaView`.
- `pierre_two/app/+not-found.tsx`: il `<View>` root sostituito da
  `<SafeAreaView>` (tutte le edges di default).

### Modali full-screen

- `pierre_two/components/event/TableReservationModal.tsx` (tour 360°):
  aggiunto `useSafeAreaInsets()`. Il pulsante back floating e
  l'indicatore di scena non hanno più `top: 60` fisso negli
  StyleSheet; ricevono `top: insets.top + 12` come override inline.
  Il canvas Marzipano resta intenzionalmente edge-to-edge — solo le
  due overlay floating sono spostate.
- `pierre_two/components/reservation/ReservationCodeModal.tsx`:
  l'overlay centrato è ora `<SafeAreaView edges={['top','bottom','left','right']}>`,
  così il dialog non finisce mai sotto la Dynamic Island in landscape.

---

## Out of scope (intenzionalmente)

- Tab screens (`index`, `explore`, `tickets`, `reservations`,
  `profile`): già OK. Aggiungere `bottom` alle loro edges
  duplicherebbe l'inset gestito dalla custom tab bar.
- `app/stripe-redirect.tsx`: già `edges={['top','bottom']}`.
- `app/pay/[token].tsx`, `EventDetailModal`, `TicketPurchaseModal`,
  `TableReservationDetailModal`: già hanno `paddingBottom` manuale
  negli ScrollView e visivamente non presentano il difetto
  riportato dall'utente.

---

## Files Modified

| File | Cambiamento |
|---|---|
| `pierre_two/app/_layout.tsx` | Aggiunto `SafeAreaProvider` come outermost provider. |
| `pierre_two/app/register.tsx` | Wrappati entrambi gli step in `SafeAreaView` con edges top+bottom. |
| `pierre_two/app/login.tsx` | Wrappato in `SafeAreaView` con edges top+bottom. |
| `pierre_two/app/modal.tsx` | Wrappato in `SafeAreaView`. |
| `pierre_two/app/+not-found.tsx` | Root `View` sostituito da `SafeAreaView`. |
| `pierre_two/components/event/TableReservationModal.tsx` | Back button e scene indicator ora usano `insets.top + 12` invece di `top: 60` hard-coded. |
| `pierre_two/components/reservation/ReservationCodeModal.tsx` | Overlay centrato wrappato in `SafeAreaView`. |
