# 2026-05-05: Fix crash Marzipano sul cambio scena

**Branch**: `fix/marzipano-viewer-scene-switch-crash`
**Status**: Done — fix client-side al `viewer.html`, da verificare in app

---

## Overview

Cliccando su un hotspot di tipo "scene-link" (link verso un'altra area del
tour 360°), il viewer crashava con:

```
setTimeout error: undefined is not an object (evaluating 'e.style')
```

Schermata di errore "Failed to Load 360° Tour", riproducibile da più eventi.

L'errore si verificava sia su scene-link cliccati (hotspot) sia sui cambi
scena pilotati da React Native via `window.switchToScene` (es. menu
hamburger), perché entrambi i path avevano lo stesso pattern bacato.

---

## Root cause

Marzipano gestisce gli hotspot agganciandoli al `hotspotContainer` di una
scena e ne aggiorna periodicamente lo stile per riposizionarli nello spazio
3D durante una transizione. Il viewer chiamava `clearHotspots()` (che fa
`instance.destroy()` su ogni hotspot) **prima** di `scene.switchTo({
transitionDuration: 500 })`, mentre Marzipano stava ancora animando la
transizione di 500 ms. Al primo `setTimeout` interno di Marzipano dopo la
distruzione, `e.style` era `undefined` → eccezione, catturata dal nostro
`try/catch` e propagata come "ERROR" alla UI.

Lo stesso pattern era anche nella branch "subsequent switches" di
`switchToScene`, con un'aggravante: `scene.switchTo` veniva chiamato senza
callback e `createHotspots` partiva subito dopo, generando una race
condition con la transizione.

---

## Fix

In entrambi i path:

- `clearHotspots()` spostato **dentro** il callback di completamento di
  `scene.switchTo`, eseguito quando Marzipano ha finito la transizione e
  rilasciato i suoi reference agli elementi DOM degli hotspot.
- `createHotspots()` rimane post-switch, ma ora arriva nello stesso callback
  (subito dopo `clearHotspots`) — niente più race tra creazione nuovi e
  transizione in corso.
- `scene.switchTo` nella branch "subsequent" ora riceve un callback
  esplicito, allineandosi al path scene-link.
- Aggiunto un commento sul perché del pattern, per evitare che un futuro
  refactor reintroduca l'ordine "destroy → switch".

---

## Files Modified

| File | Modifica |
|---|---|
| `pierre_two/assets/marzipano/viewer.html` | `handleSceneLinkClick`: clearHotspots spostato dentro callback `switchTo`; `switchToScene` (subsequent branch): aggiunto callback a `switchTo` con clearHotspots/createHotspots all'interno |

---

## Verifica

- Aprire un evento con tour 360 multi-scena (es. "Prezioso" → fallback dal
  club "Test Club") → "Prenota tavolo" → cliccare uno scene-link.
- Stesso test usando il menu hamburger per saltare a un'altra area.
- Il viewer deve completare la transizione senza errori, mostrare il nome
  della nuova scena nell'indicatore in alto a destra, e ripopolare gli
  hotspot tavolo della nuova area.
