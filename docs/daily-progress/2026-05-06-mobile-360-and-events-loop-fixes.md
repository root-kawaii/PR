# 2026-05-06: Fix mobile — 360° viewer, eventi loop, immagini Supabase

**Branch**: `fix/mobile-360-and-events-loop`
**Status**: Done — verificato in iOS Simulator (sala principale ↔ area VIP).

---

## Overview

Tre bug intrecciati sul mobile, scoperti aprendo l'app per la prima volta nel
simulatore:

1. La home rifaceva la chiamata `GET /events` in loop infinito appena
   caricata, e gli `EventCard` venivano smontati/rimontati ad ogni tick.
2. Le immagini degli eventi (Supabase Storage) restavano `pending` all'infinito
   nel loader RN.
3. Nel tour 360° gli hotspot della seconda scena non si agganciavano alla
   `view` di Marzipano: o restavano `display:none`, o stavano fissi a schermo
   mentre l'utente ruotava la sfera.

---

## Backend

Nessuna modifica.

---

## Mobile

### Loop infinito su `/events`

`hooks/useEvents.tsx` ridefiniva `fetchEvents` ad ogni render, esponendola come
`refetch`. In `app/(tabs)/index.tsx` `useFocusEffect(useCallback(() => {
refetchEvents(true); }, [refetchEvents]))` rilanciava la callback ogni volta che
`refetchEvents` cambiava identità: `setEvents` → re-render → nuova
`refetchEvents` → useCallback nuovo → useFocusEffect rilanciato → loop. Effetto
collaterale: `setEvents(page.events)` rimpiazzava l'array, gli `EventCard`
remountavano e l'`<Image>` non finiva mai il download. Wrappato `fetchEvents`
e `loadMore` in `useCallback` con deps stabili.

### Immagini Supabase Storage in timeout

Anche col loop risolto, le `<Image>` di RN andavano in `request timed out`
sulla rete del simulatore iOS verso `cnvnugirbftyblxnkqbf.supabase.co`. Il
fetch JS (`fetch()`) invece tornava 200. Sostituito `Image` di
`react-native` con `Image` di `expo-image` (loader nativo SDWebImage / Glide,
già in `package.json` ma non utilizzato) in `EventCard.tsx`.

### Marzipano scene-switch — refactor "destroy+recreate"

Il bug originale "hotspot non si muovono nella seconda scena" non era una
race su `clearHotspots`: anche dopo il fix di [PR #45], gli hotspot creati
dentro la callback di `scene.switchTo` restavano `display:none` perché il
render loop di Marzipano era idle (la fade-in del layer era già finita) e
l'evento `change` sulla view non era abbastanza forte per far ripartire un
tick. Ho provato `view.setYaw` con epsilon, `hc._update()`,
`viewer.updateSize()`, `viewer.renderLoop().renderOnNextFrame()`,
`hotspot.setPosition(hotspot.position())`: nessuno positionava i nuovi
hotspot.

Cambiato approccio: smontare e rimontare l'intero `Marzipano.Viewer` ad ogni
cambio scena. Dato che il path di init era l'unico stato che funzionasse, ora
ogni `loadScene(id)` fa:

1. `preloadImage(url)` per scaldare la cache del WebView
2. `clearHotspots()` + `viewer.destroy()` + svuota `#pano`
3. `new Marzipano.Viewer(panoElement, …)`
4. `createScene(config)` + `scene.switchTo({transitionDuration: 0})`
5. `currentHotspotContainer = scene.hotspotContainer()` + `createHotspots(…)`

`switchToScene` (chiamato da scene-link click e da React) invoca
`loadScene` con un fade `#pano` opacity 0→1 di mascheramento. Eliminate
le funzioni `kickHotspotRender`, `destroyHotspotList`, e tutta la
diagnostica accumulata durante l'investigazione.

#### Stack overflow ricorsivo nel wrapper `window.switchToScene`

In non-strict-mode `function switchToScene` al top-level diventa
`window.switchToScene`. La riga `window.switchToScene = function(sceneId) {
switchToScene(sceneId); };` riassegnava `window.switchToScene` al wrapper, e
da quel momento `switchToScene(...)` (anche dentro `handleSceneLinkClick`)
risolveva al wrapper invece che alla funzione `async`: ricorsione infinita,
"Maximum call stack size exceeded" alla prima clic VIP. Rimosso il wrapper:
la funzione è già esposta su `window` via hoisting.

### Deduplica table hotspot in `buildViewerConfig`

`MarzipanoViewer.tsx` mergava gli hotspot della scena e i `tables` con
`marzipanoPosition.sceneId === scene.id`: i tavoli salvati in entrambi i
posti dalla dashboard apparivano due volte. Ricostruito il merge: una mappa
`tableId → position` con `scene.hotspots[type=table]` (legacy) come base,
sovrascritta dai `tables[].marzipanoPosition` (canonico). I non-table
hotspot passano invariati.

### Pulizia Expo Router

`(tabs)/search.tsx` era un file vuoto, ma il layout dei tab dichiarava
`<Tabs.Screen name="search" href={null}/>`. Risultato: due warning ad ogni
render — "Route ./(tabs)/search.tsx is missing the required default export"
e "Too many screens defined. Route 'search' is extraneous". La rotta vera
era `explore.tsx`. Eliminato `search.tsx`, rimossa la dichiarazione fantasma
dal layout.

---

## Dashboard

Nessuna modifica in questo PR. L'utente ha segnalato due ulteriori problemi
da affrontare separatamente:

- Cancellando una scena dal `TourConfigurator` la pagina crasha (da
  riprodurre con DevTools console aperti per ottenere lo stack).
- Il flusso di salvataggio assegna `marzipanoPosition.sceneId` a tavoli che
  l'utente non intendeva associare alla scena attiva (causa dei "tavoli in
  più" sul mobile prima della deduplica).

---

## Database

Nessuna modifica.

---

## Files Modified

| File | Modifica |
|---|---|
| `pierre_two/hooks/useEvents.tsx` | `fetchEvents` / `loadMore` wrappati in `useCallback` per stabilizzare le reference |
| `pierre_two/components/home/EventCard.tsx` | switch da `Image` di `react-native` a `Image` di `expo-image` |
| `pierre_two/assets/marzipano/viewer.html` | Refactor `loadScene`: distrugge e ricrea l'intero viewer ad ogni cambio scena. Rimosso wrapper `window.switchToScene` (causa di ricorsione). Rimossa diagnostica residua |
| `pierre_two/components/event/MarzipanoViewer.tsx` | `buildViewerConfig`: dedup table hotspot per `tableId` |
| `pierre_two/app/(tabs)/_layout.tsx` | Rimosso `<Tabs.Screen name="search" href={null}/>` |
| `pierre_two/app/(tabs)/search.tsx` | Eliminato (file vuoto, route fantasma) |

---

## Verifica (fix originali)

- Aprire l'app nel simulatore iOS e osservare in Metro che `GET
  /events?limit=20&offset=0` parte una sola volta al focus della home.
- Ogni `EventCard` deve mostrare l'immagine entro pochi secondi (nessun
  timeout silenzioso).
- Aprire un evento → "Prenota tavolo" → tour 360°. Dalla scena iniziale
  cliccare uno scene-link, attendere il fade. Nella nuova scena gli hotspot
  devono essere visibili e seguire la rotazione del 360 quando l'utente fa
  drag.
- Tornare indietro e ripetere: niente più crash "Maximum call stack size
  exceeded" o `e.style undefined`.

---

# Refactor: unica fonte di verità per il tour 360° + prenotazione per area

**Status**: implementazione completa — migration da applicare su Supabase.

## Overview

Due problemi risolti in un'unica serie di modifiche:

1. **Doppia fonte di verità**: le posizioni degli hotspot erano salvate sia
   in `events.marzipano_config` (scene.hotspots) sia in
   `tables.marzipano_position`. Questo causava hotspot doppi nel viewer.
   Soluzione: `marzipano_config` diventa l'unica fonte di verità; la colonna
   `marzipano_position` viene droppata da `tables` e `areas`.

2. **Prenotazione per area, non per tavolo**: gli hotspot tavolo spariscono
   dal viewer. Rimangono solo due tipi: `scene-link` (navigazione) e `area`
   (prenota un tavolo nell'area). Il backend auto-assegna il primo tavolo
   libero dell'area usando `SELECT ... FOR UPDATE`.

## Database

### Migration `044_simplify_marzipano_positions.sql`

- Backfill best-effort: copia le posizioni da `marzipano_position` nella
  scena corrispondente di `marzipano_config` se l'hotspot mancava.
- `ALTER TABLE tables DROP COLUMN IF EXISTS marzipano_position`
- `ALTER TABLE areas DROP COLUMN IF EXISTS marzipano_position`
- Drop dell'indice `idx_tables_marzipano_position`

## Backend

### Modelli (`models/table.rs`, `models/area.rs`)

Rimosso `marzipano_position: Option<JsonValue>` da `Table`, `TableResponse`,
`Area`, `AreaResponse`.

### Persistenze

- `table_persistence.rs`: rimosso campo dai SELECT/INSERT/UPDATE; aggiunta
  `find_first_available_table_by_area` (senza lock, per pricing preview).
- `area_persistence.rs`: rimosso campo dai SELECT/INSERT/UPDATE.

### Controller `club_owner_controller.rs`

Rimosso il loop che aggiornava `marzipano_position` sulle singole righe dopo
il salvataggio delle scene.

### Controller `table_controller.rs`

`create_payment_intent` e `create_reservation_with_payment` ora accettano
`area_id` in alternativa a `table_id`:
- Se `area_id` → `find_first_available_table_by_area` fuori transazione per
  ottenere prezzi; dentro la transazione `SELECT ... FOR UPDATE WHERE id = $1
  AND available = true` per prevenire double-booking.
- Se `table_id` → comportamento invariato (backward compatibility).
- Se nessuno dei due → 400 Bad Request.

## Mobile (`pierre_two`)

### `types/index.ts`

- Rimosso `marzipanoPosition?: MarzipanoPosition` da `Table`
- Rimosso il tipo `MarzipanoPosition`
- `MarzipanoHotspot.type`: solo `'scene-link' | 'area'` (rimosso `'table'`)
- Aggiunto campo opzionale `availableCount?: number`

### `MarzipanoViewer.tsx`

- `buildViewerConfig`: arricchisce gli hotspot `area` con `availableCount`
  (conteggio tavoli disponibili in quella area); gli hotspot `table`
  scompaiono (non esistono più nel config).
- Rimosso `updateHotspotVisibility` dalla ref API; rimosso `onTableClick`.
- `AREA_CLICK`: chiama direttamente `onAreaClickRef.current` (non più
  opzionale).

### `TableReservationModal.tsx`

- `handleAreaClick`: trova il primo tavolo disponibile nell'area e apre
  subito il popup di prenotazione.
- Rimosso `TableFilterMenu`, menu hamburger, e tutta la logica di filtraggio
  per tavolo.
- `MarzipanoViewer` montato con `onAreaClick={handleAreaClick}`.

## Dashboard (`pierre_dashboard`)

### `types/index.ts`

- Rimosso `MarzipanoPosition`
- `MarzipanoHotspotType = 'scene-link' | 'area'`
- Rimossi `tableId?`, `tableName?` da `MarzipanoHotspot`
- `TourConfigPayload = { scenes: MarzipanoScene[] | null }` (rimossi
  `tablePositions`, `areaPositions`)
- Rimosso `marzipanoPosition` da `Table` e `Area`

### `HotspotInspector.tsx`

Solo due tipi nel dropdown: `area` e `scene-link`. Rimosso il blocco
configurazione table hotspot.

### `TourConfigurator.tsx`

Rimossi `tablePositions`/`areaPositions` dallo state, `syncPositions()`,
`hotspotToPosition()`. Payload di salvataggio semplificato a
`{ scenes: state.scenes }`. Click su canvas in armed mode crea hotspot
`type: 'area'`.

### `ClubTourConfigPage.tsx`, `EventTourConfigPage.tsx`

Rimosso fetch delle tables; `handleResetOverride` usa `{ scenes: null }`.

## Files Modified

| File | Modifica |
|---|---|
| `DB/migrations/044_simplify_marzipano_positions.sql` | Nuova migration: backfill + drop colonne |
| `rust_BE/src/models/table.rs` | Rimosso `marzipano_position` |
| `rust_BE/src/models/area.rs` | Rimosso `marzipano_position` |
| `rust_BE/src/infrastructure/repositories/table_persistence.rs` | Rimosso campo; aggiunta `find_first_available_table_by_area` |
| `rust_BE/src/infrastructure/repositories/area_persistence.rs` | Rimosso `marzipano_position` |
| `rust_BE/src/controllers/club_owner_controller.rs` | Rimosso loop aggiornamento posizioni |
| `rust_BE/src/controllers/table_controller.rs` | Auto-assegnazione area con FOR UPDATE |
| `rust_BE/src/controllers/area_controller.rs` | Adattato a modello senza `marzipano_position` |
| `pierre_two/types/index.ts` | Tipi semplificati |
| `pierre_two/components/event/MarzipanoViewer.tsx` | `buildViewerConfig` semplificato |
| `pierre_two/components/event/TableReservationModal.tsx` | `handleAreaClick`, rimosso `TableFilterMenu` |
| `pierre_dashboard/src/types/index.ts` | Tipi semplificati |
| `pierre_dashboard/src/components/tour/HotspotInspector.tsx` | Solo 2 tipi hotspot |
| `pierre_dashboard/src/components/tour/TourConfigurator.tsx` | Rimossi state e funzioni ridondanti |
| `pierre_dashboard/src/components/tour/MarzipanoCanvas.tsx` | Schema colori aggiornato |
| `pierre_dashboard/src/pages/ClubTourConfigPage.tsx` | Rimosso prop `tables` |
| `pierre_dashboard/src/pages/EventTourConfigPage.tsx` | Rimosso fetch tables; fix payload |
