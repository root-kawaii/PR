# Piano: Estensione Gestionale Club Owner

## Context
Il club owner dashboard (pierre_dashboard) ha funzionalità base: visualizzazione info club, gestione eventi, gestione tavoli per evento. Si vuole estendere con: modifica info locale, scanner QR ticket, immagini multiple, prenotazioni manuali, filtri tavoli, vista prenotazioni per serata, e altri miglioramenti utili.

---

## Modifiche DB Necessarie (da discutere col collega)

### Nuove tabelle

```sql
-- Immagini multiple per il locale
CREATE TABLE club_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    alt_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_club_images_club_id ON club_images(club_id);

-- Immagini multiple per i tavoli
CREATE TABLE table_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    alt_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_table_images_table_id ON table_images(table_id);
```

### Modifiche a tabelle esistenti

```sql
-- Prenotazioni manuali su table_reservations
ALTER TABLE table_reservations
    ADD COLUMN is_manual BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN manual_notes TEXT;  -- note interne del club owner
```

> **Nota:** clubs ha già: address, phone_number, website. Nessuna modifica necessaria.

---

## Nuove Pagine Dashboard

### 1. Impostazioni Locale (`/dashboard/club`)
**File:** `pierre_dashboard/src/pages/ClubSettingsPage.tsx`

- Form per modificare: name, subtitle, address, phone_number, website
- Sezione galleria immagini (aggiunta/rimozione/riordino foto del locale)
- API: `PUT /owner/club` (esistente da aggiungere al backend), `GET/POST/DELETE /owner/club/images`

### 2. Scanner QR (`/dashboard/scan`)
**File:** `pierre_dashboard/src/pages/QRScannerPage.tsx`

- Usa webcam via `html5-qrcode` o `@zxing/browser` (libreria npm da aggiungere)
- Input manuale del codice come fallback
- Su scansione: chiama `GET /owner/scan/:code`
- Mostra risultato: ✅ VALIDO / ❌ NON VALIDO / ⚠️ GIÀ USATO
- Info mostrate: nome cliente, numero persone, nome evento/tavolo, stato
- Bottone per segnare come entrato (mark as checked-in)
- API: `GET /owner/scan/:code` → restituisce info ticket/prenotazione; `POST /owner/checkin/:code` → marca come usato

### 3. Prenotazioni per Evento (`/dashboard/events/:id/reservations`)
**File:** `pierre_dashboard/src/pages/EventReservationsPage.tsx`

- Lista tutte le prenotazioni per l'evento selezionato
- Filtri: per status (pending/confirmed/completed/cancelled), ricerca per nome/codice
- Ogni riga mostra: codice prenotazione, nome cliente, tavolo, n° persone, importo, status
- Azioni per riga: conferma, completa, cancella, view dettaglio
- Form "Nuova Prenotazione Manuale":
  - Selezione tavolo (dropdown con disponibili)
  - Nome, telefono, email cliente
  - Numero persone
  - Note interne
  - is_manual = true automaticamente
- API: `GET /owner/events/:id/reservations`, `POST /owner/events/:id/reservations/manual`, `PATCH /owner/reservations/:id/status`

### 4. Statistiche Dashboard (`/dashboard`)
**Estendere:** `pierre_dashboard/src/pages/DashboardPage.tsx`

- Aggiungere: n° prenotazioni attive, incasso totale, capienza utilizzata
- Lista ultimi eventi con % di posti prenotati
- API: `GET /owner/stats`

---

## Miglioramenti Pagine Esistenti

### EventTablesPage (già esistente)
**File:** `pierre_dashboard/src/pages/EventTablesPage.tsx`

- Aggiungere filtri: per zona, per disponibilità (libero/occupato), per capienza
- Aggiungere galleria immagini per ogni tavolo
- Link rapido a "Vedi Prenotazioni" per aprire EventReservationsPage filtrata su quel tavolo
- API: `GET/POST/DELETE /owner/tables/:id/images`

---

## Nuove Route & Navigazione

### App.tsx
Aggiungere routes:
```
/dashboard/club         → ClubSettingsPage
/dashboard/scan         → QRScannerPage
/dashboard/events/:id/reservations → EventReservationsPage
```

### Layout.tsx (Sidebar)
Aggiungere voci:
- **Impostazioni Locale** → `/dashboard/club`
- **Scanner QR** → `/dashboard/scan`
- Il link Eventos già porta a `/dashboard/events`; le prenotazioni si accedono dall'evento

---

## Nuovi Tipi TypeScript

**File:** `pierre_dashboard/src/types/index.ts`

```typescript
interface ClubImage {
  id: string;
  clubId: string;
  url: string;
  displayOrder: number;
  altText?: string;
}

interface TableImage {
  id: string;
  tableId: string;
  url: string;
  displayOrder: number;
  altText?: string;
}

interface TableReservation {
  id: string;
  reservationCode: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  numPeople: number;
  totalAmount: string;
  amountPaid: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  specialRequests?: string;
  isManual: boolean;
  manualNotes?: string;
  table: { id: string; name: string; zone: string };
  event: { id: string; title: string; date: string };
}

interface ScanResult {
  valid: boolean;
  alreadyUsed: boolean;
  type: 'ticket' | 'reservation';
  guestName?: string;
  numPeople?: number;
  eventTitle?: string;
  tableName?: string;
  code: string;
}
```

---

## API Endpoints da Aggiungere al Backend Rust

| Metodo | Path | Descrizione |
|--------|------|-------------|
| PUT | `/owner/club` | Modifica info locale |
| GET | `/owner/club/images` | Lista immagini locale |
| POST | `/owner/club/images` | Aggiunge immagine locale |
| DELETE | `/owner/club/images/:id` | Rimuove immagine locale |
| GET | `/owner/tables/:id/images` | Lista immagini tavolo |
| POST | `/owner/tables/:id/images` | Aggiunge immagine tavolo |
| DELETE | `/owner/table-images/:id` | Rimuove immagine tavolo |
| GET | `/owner/events/:id/reservations` | Prenotazioni per evento |
| POST | `/owner/events/:id/reservations/manual` | Crea prenotazione manuale |
| PATCH | `/owner/reservations/:id/status` | Cambia status prenotazione |
| GET | `/owner/scan/:code` | Valida codice QR/prenotazione |
| POST | `/owner/checkin/:code` | Segna come entrato |
| GET | `/owner/stats` | Statistiche dashboard |

---

## Dipendenze npm da Aggiungere (Dashboard)

```bash
npm install html5-qrcode  # oppure @zxing/browser per scanner QR da webcam
```

---

## Priorità di Implementazione

**Alta priorità (subito)**
1. Prenotazioni per evento (EventReservationsPage) — molto utile operativamente
2. Modifica info locale (ClubSettingsPage) — base
3. Filtri tavoli — migliora l'esistente senza DB

**Media priorità (dopo conferma DB con collega)**
4. Prenotazioni manuali (richiede colonne `is_manual`, `manual_notes`)
5. Scanner QR (richiede nuovi endpoint backend)
6. Immagini multiple (richiede nuove tabelle `club_images`, `table_images`)

**Bassa priorità (nice to have)**
7. Statistiche dashboard
8. Export prenotazioni CSV

---

## File Critici da Modificare

- `pierre_dashboard/src/App.tsx` — nuove routes
- `pierre_dashboard/src/components/Layout.tsx` — sidebar navigation
- `pierre_dashboard/src/pages/DashboardPage.tsx` — statistiche
- `pierre_dashboard/src/pages/EventTablesPage.tsx` — filtri + immagini
- `pierre_dashboard/src/types/index.ts` — nuovi tipi

## File Nuovi da Creare

- `pierre_dashboard/src/pages/ClubSettingsPage.tsx`
- `pierre_dashboard/src/pages/QRScannerPage.tsx`
- `pierre_dashboard/src/pages/EventReservationsPage.tsx`
- `DB/migrations/030_club_table_images.sql` (o numero successivo disponibile)
- `DB/migrations/031_manual_reservations.sql`

---

## Verifica

Per testare end-to-end dopo l'implementazione:
1. Login come club owner
2. Navigare in Impostazioni Locale → modificare un campo → verificare che si salvi
3. Aprire un evento → Prenotazioni → creare una prenotazione manuale
4. Aprire Scanner QR → scansionare un codice di prenotazione → verificare che mostri nome e numero persone
5. Aprire Gestione Tavoli → verificare filtri per zona/disponibilità
