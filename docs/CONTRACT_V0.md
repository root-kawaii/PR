# PROGETTO PIERRE v0.x – Contract File

**Status**: In planning  
**Last Updated**: 2026-04-30  

---

## Team

| Membro | Ruolo | Focus |
|--------|-------|-------|
| **Vale** | Dev | `pierre_dashboard` (web), flexible |
| **Regge** | Dev | `pierre_two` (mobile), `rust_BE`, flexible |
| **Matte** | Business | Prodotto, vendor relations |
| **Ale** | Business | Prodotto, vendor relations |

---

## Overview

Questo documento traccia i requisiti per le prossime versioni di Pierre, coordinando il lavoro tra i package:
- `pierre_two` (React Native mobile)
- `pierre_dashboard` (React + Vite web)
- `rust_BE` (Axum backend)
- `DB` (PostgreSQL)

---

## Requisiti Implementativi

### 0.1 – Gestire le aree e tavoli per locale
**Descrizione**: Configurazione flessibile di aree e tavoli, con possibilità di override per serata.

**Owner**: 
- [ ] Vale
- [ ] Regge

**Package coinvolti**:
- `rust_BE`: Endpoint CRUD per aree/tavoli, override per serata
- `DB`: Schema per aree, tavoli, override_event
- `pierre_dashboard`: UI per configurazione

**Dettagli**:
- [ ] Modello dati per aree e tavoli
- [ ] Modello dati per override per serata
- [ ] API endpoints (GET, POST, PUT, DELETE)
- [ ] Dashboard UI per gestione

---

### 0.2 – Togliere azioni sul tavolo
**Descrizione**: Rimuovere azioni "foto" e "prenotazioni" a livello tavolo. Foto solo a livello locale/evento.

**Owner**:
- [ ] Vale
- [ ] Regge

**Package coinvolti**:
- `rust_BE`: Rimuovere endpoint relativi a foto su tavolo
- `DB`: Deprecare/rimuovere colonne
- `pierre_dashboard`: Rimuovere UI per foto su tavolo

**Dettagli**:
- Attualmente: "foto" e "prenotazioni" su tavolo
- A tendere: foto solo a livello locale e al massimo sull'evento
- [ ] Identificare colonne/tabelle da deprecare
- [ ] Migrare/rimuovere dati legacy
- [ ] Aggiornare API
- [ ] Aggiornare dashboard

---

### 0.3 – Migliorare dashboard con statistiche
**Descrizione**: Aggiungere statistiche per locale e serata.

**Owner**:
- [ ] Vale
- [ ] Regge

**Package coinvolti**:
- `rust_BE`: Endpoint per statistiche
- `DB`: Query aggregate (M/F, expected incomes, etc.)
- `pierre_dashboard`: Widgets per visualizzazione

**Statistiche richieste**:
- Divisione maschio/femmina
- Expected incomes
- Altri dati statistici (TBD con team)

**Dettagli**:
- [ ] Definire endpoint `/stats/{locale_id}/{event_id}`
- [ ] Definire schema risposta
- [ ] Query aggregate sul DB
- [ ] Dashboard widgets (charts, cards, etc.)

**Implementato (commit ad198c6)**:
- [x] Colonne `male_guest_count` / `female_guest_count` su `table_reservations` (migration 043)
- [x] Endpoint `/owner/events/:id/stats` con `maleGuests` / `femaleGuests`
- [x] Widget M/F e totale persone in `EventReservationsPage`
- [ ] Expected incomes — non ancora implementato
- [ ] Altri dati statistici TBD

---

### 0.4 – Gestire info a livello di prenotazione
**Descrizione**: Permettere modifica completa della prenotazione e assegnazione tavolo.

**Owner**:
- [ ] Vale
- [ ] Regge

**Package coinvolti**:
- `rust_BE`: Endpoint PATCH per prenotazione
- `DB`: Schema prenotazione (già exists, aggiornare)
- `pierre_dashboard`: UI modale per modifica (vedi 0.7)

**Campi modificabili**:
- Numero persone
- Numero maschi/femmine
- Stato
- Tavolo associato (vedi 0.4.1)

**Dettagli**:
- [x] Endpoint `PATCH /owner/reservations/:id` — implementato
- [x] Tutti i campi modificabili: persone, maschi/femmine, stato, tavolo, contatti, note
- [x] Validazione conteggi genere (maleCount + femaleCount ≤ numPeople)
- [x] UI modale in dashboard
- [ ] Audit log per tracciare modifiche — non ancora implementato

---

#### 0.4.1 – Cambio tavolo facile
**Descrizione**: Il gestore deve poter facilmente cambiare il tavolo associato a una prenotazione.

**UX**: 
- Modale di modifica prenotazione con dropdown/select tavoli disponibili
- [x] Logica per filtrare tavoli disponibili (per evento)
- [x] Aggiornamento tavolo in prenotazione
- [x] Feedback visuale
- [x] Cambio tavolo inline direttamente dalla lista prenotazioni (senza aprire il modale)

---

### 0.5 – Stati della prenotazione
**Descrizione**: Workflow degli stati di prenotazione.

**Owner**:
- [ ] Vale
- [ ] Regge

**Package coinvolti**:
- `rust_BE`: State machine logic
- `DB`: Campo `status` enum
- `pierre_dashboard`: UI per transizione stati (vedi 0.7)

**Stati**:
1. **"in_attesa"** – numero minimo non raggiunto
2. **"prenotato"** – numero minimo raggiunto
3. **"accesso_effettuato"** – QR scannerizzato correttamente
4. **"accesso_rifiutato"** – QR scannerizzato, ma buttafuori ha rifiutato (con giustificativo opzionale)
5. **"cancellato"** – rimosso da utente o gestore

**Dettagli**:
- [ ] Enum nel DB
- [ ] Transizioni valide tra stati (state machine formale)
- [ ] Campo `refusal_reason` opzionale per "accesso_rifiutato"
- [ ] Timestamp per ogni cambio stato

**Implementato (commit ad198c6)**:
- [x] Pulsante "Rifiuta prenotazione" nello scanner QR (oltre a "Conferma ingresso")
- [x] Push notifications al cliente su ogni cambio stato (confermata, rifiutata, check-in, in attesa)

---

## Open Points

### 0.6 – OPEN POINT: Selezione tavolo in app
**Questione**: Come l'utente seleziona il tavolo nella `pierre_two` app?

**Owner** (discussion + decision):
- [ ] Matte
- [ ] Ale

**Business expectation (v0)**: 
- Utente seleziona solo **zone**
- Tavolo assegnato dal gestore (dashboard) o sistema automatico

**Possibile conflict**:
- Alcuni locali potrebbero volere selezione diretta del tavolo

**Implicazioni architetturali**:
- Se solo zone: prenotazione non ha `table_id` inizialmente, assegnato dopo
- Se tavolo diretto: prenotazione ha `table_id` da subito

**Action items**:
- [ ] Chiarire con team business il modello preferito
- [ ] Verificare se è per locale o globale
- [ ] Decidere strategy (feature flag? setting per locale?)

**Blockers**: Nessuno finché non chiarito

---

### ~~0.7 – OPEN POINT: UI per modifica prenotazione~~ — RESOLVED

**Soluzione adottata**: Modale singola con tutti i campi modificabili (nome, telefono, email, numero persone, maschi/femmine, stato, tavolo, note). Implementata in `EventReservationsPage` (commit ad198c6).

---

## Dipendenze tra requisiti

```
0.1 (aree/tavoli) ──→ 0.4 (modifica prenotazione)
                       ├─→ 0.4.1 (cambio tavolo)

0.5 (stati) ────────→ 0.4 (modifica prenotazione)

0.6 (select tavolo app) ──→ 0.4 (tavolo in prenotazione)

0.3 (statistiche) ───→ (no dipendenze, indipendente)

0.2 (rimuovere foto tavolo) ──→ (no dipendenze, cleanup)
```

---

## Planning per Package

### `rust_BE` – Priorità
1. 0.1 – Aree/tavoli endpoints
2. 0.5 – State machine logic
3. ~~0.4 – PATCH prenotazione endpoint~~ ✅ fatto
4. 0.3 – Statistiche endpoints (expected incomes)
5. 0.2 – Deprecare foto su tavolo

### `DB` – Priorità
1. 0.1 – Schema aree, tavoli, override
2. 0.5 – Enum stati, `refusal_reason`, timestamp
3. ~~0.4 – Campi prenotazione aggiornati~~ ✅ fatto
4. 0.3 – Indici per query aggregate (expected incomes)
5. 0.2 – Deprecare colonne foto

### `pierre_dashboard` – Priorità
1. 0.1 – UI aree/tavoli configuration
2. ~~0.7 – Modale modifica prenotazione~~ ✅ fatto
3. 0.3 – Statistiche widgets (expected incomes)
4. 0.2 – Rimuovere foto UI

### `pierre_two` – Priorità
1. 0.6 – Adattarsi a selezione zone (BLOCKED finché 0.6 non è chiarito)

---

## Prossimi step

- [ ] Riunione con team business per chiarire 0.6
- [ ] Kickoff implementazione 0.1, 0.5 (no blockers)
- [ ] Setup migration DB per schema nuovo
- [ ] Definire expected incomes per 0.3
