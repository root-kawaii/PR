import { useEffect, useRef, useState } from 'react';
import {
  createSceneFromUrl,
  createViewer,
  useMarzipano,
  type MarzipanoHotspotHandle,
  type MarzipanoSceneHandle,
  type MarzipanoViewerHandle,
} from '../../hooks/useMarzipano';
import type { MarzipanoHotspot, MarzipanoScene } from '../../types';

interface MarzipanoCanvasProps {
  scene: MarzipanoScene | null;
  selectedHotspotId: string | null;
  onReady?: (view: { yaw: number; pitch: number; fov: number }) => void;
  onCanvasClick?: (coords: { yaw: number; pitch: number }) => void;
  onHotspotDrag?: (hotspotId: string, coords: { yaw: number; pitch: number }) => void;
  onHotspotSelect?: (hotspotId: string) => void;
  onViewChange?: (view: { yaw: number; pitch: number; fov: number }) => void;
  armed?: boolean;
}

interface SceneEntry {
  sceneHandle: MarzipanoSceneHandle;
  hotspotHandles: Map<string, MarzipanoHotspotHandle>;
}

export default function MarzipanoCanvas({
  scene,
  selectedHotspotId,
  onReady,
  onCanvasClick,
  onHotspotDrag,
  onHotspotSelect,
  onViewChange,
  armed = false,
}: MarzipanoCanvasProps) {
  const { ready, error } = useMarzipano();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<MarzipanoViewerHandle | null>(null);
  const sceneCacheRef = useRef<Map<string, SceneEntry>>(new Map());
  const currentSceneIdRef = useRef<string | null>(null);
  const draggingHotspotIdRef = useRef<string | null>(null);
  // incremented each time a viewer is created so the scene effect re-fires
  const [viewerVersion, setViewerVersion] = useState(0);

  const onCanvasClickRef = useRef(onCanvasClick);
  const onHotspotDragRef = useRef(onHotspotDrag);
  const onHotspotSelectRef = useRef(onHotspotSelect);
  const onViewChangeRef = useRef(onViewChange);
  const armedRef = useRef(armed);
  useEffect(() => {
    onCanvasClickRef.current = onCanvasClick;
    onHotspotDragRef.current = onHotspotDrag;
    onHotspotSelectRef.current = onHotspotSelect;
    onViewChangeRef.current = onViewChange;
    armedRef.current = armed;
  });

  useEffect(() => {
    if (!ready || !containerRef.current || viewerRef.current) return;
    try {
      viewerRef.current = createViewer(containerRef.current);
      // bump version so the scene effect re-fires even if scene was already set
      setViewerVersion((v) => v + 1);
    } catch (err) {
      console.error('Marzipano viewer init failed', err);
    }
    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
      sceneCacheRef.current.clear();
      currentSceneIdRef.current = null;
    };
  }, [ready]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !scene) return;

    let entry = sceneCacheRef.current.get(scene.id);
    if (!entry) {
      try {
        const handle = createSceneFromUrl(viewer, scene.imageUrl, scene.initialView);
        entry = { sceneHandle: handle, hotspotHandles: new Map() };
        sceneCacheRef.current.set(scene.id, entry);
      } catch (err) {
        console.error('createScene failed', err);
        return;
      }
    }

    if (currentSceneIdRef.current !== scene.id) {
      entry.sceneHandle.switchTo({ transitionDuration: 150 });
      currentSceneIdRef.current = scene.id;
      if (onReady) {
        const params = entry.sceneHandle.view().parameters();
        onReady(params);
      }
    }
  }, [scene, onReady, viewerVersion]);

  // Subscribe to Marzipano view-change events so TourConfigurator always has
  // the current yaw/pitch/fov when the user clicks "Usa vista corrente come iniziale".
  useEffect(() => {
    const id = scene?.id;
    if (!id) return;
    const entry = sceneCacheRef.current.get(id);
    if (!entry) return;
    const view = entry.sceneHandle.view();
    const handler = () => onViewChangeRef.current?.(view.parameters());
    view.addEventListener('change', handler);
    return () => view.removeEventListener('change', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.id, viewerVersion]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !scene) return;
    const entry = sceneCacheRef.current.get(scene.id);
    if (!entry) return;

    const container = entry.sceneHandle.hotspotContainer();
    const nextIds = new Set(scene.hotspots.map((h) => h.id));

    entry.hotspotHandles.forEach((handle, id) => {
      if (!nextIds.has(id)) {
        handle.destroy();
        entry.hotspotHandles.delete(id);
      }
    });

    scene.hotspots.forEach((spot) => {
      const existing = entry.hotspotHandles.get(spot.id);
      if (existing) {
        // While any drag is active, skip all Marzipano DOM mutations for existing
        // hotspots. The dragging hotspot is positioned directly by handle.setPosition
        // in onPointerMove; the others haven't moved. Any setPosition/applyHotspotStyle
        // call here during rapid drag events causes other hotspots to momentarily
        // reset to (0,0) before Marzipano recomputes their transform.
        if (draggingHotspotIdRef.current === null) {
          existing.setPosition({ yaw: spot.yaw, pitch: spot.pitch });
          const el = existing.domElement();
          applyHotspotStyle(el, spot, spot.id === selectedHotspotId);
        }
        return;
      }
      const el = buildHotspotElement(spot, spot.id === selectedHotspotId);
      const handle = container.createHotspot(el, { yaw: spot.yaw, pitch: spot.pitch });
      attachHotspotInteractions(el, spot.id, handle, entry.sceneHandle);
      entry.hotspotHandles.set(spot.id, handle);
    });
  }, [scene, selectedHotspotId, viewerVersion]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      if (!armedRef.current) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-hotspot-id]')) return;

      const viewer = viewerRef.current;
      const sceneHandle = viewer?.scene();
      if (!sceneHandle) return;
      const rect = el.getBoundingClientRect();
      const coords = sceneHandle
        .view()
        .screenToCoordinates({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      onCanvasClickRef.current?.(coords);
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, []);

  function attachHotspotInteractions(
    el: HTMLElement,
    hotspotId: string,
    handle: MarzipanoHotspotHandle,
    sceneHandle: MarzipanoSceneHandle,
  ) {
    let dragging = false;
    let moved = false;
    // Marzipano anchors the hotspot at the element's top-left corner.
    // We capture the cursor-to-top-left offset at grab time so that corner
    // follows the grab point rather than jumping to the cursor.
    let grabOffsetX = 0;
    let grabOffsetY = 0;

    const onPointerDown = (e: PointerEvent) => {
      e.stopPropagation();
      dragging = true;
      moved = false;
      draggingHotspotIdRef.current = hotspotId;
      el.setPointerCapture(e.pointerId);
      const elRect = el.getBoundingClientRect();
      grabOffsetX = e.clientX - elRect.left;
      grabOffsetY = e.clientY - elRect.top;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const container = containerRef.current;
      if (!container) return;
      moved = true;
      const rect = container.getBoundingClientRect();
      // Place the element's top-left corner at (cursor − grabOffset),
      // keeping the exact grab point under the cursor.
      const coords = sceneHandle
        .view()
        .screenToCoordinates({
          x: e.clientX - grabOffsetX - rect.left,
          y: e.clientY - grabOffsetY - rect.top,
        });
      handle.setPosition(coords);
      onHotspotDragRef.current?.(hotspotId, coords);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      draggingHotspotIdRef.current = null;
      el.releasePointerCapture(e.pointerId);
      if (!moved) {
        onHotspotSelectRef.current?.(hotspotId);
      }
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl bg-gray-900 p-6 text-white">
        Errore caricando Marzipano: {error}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-black">
      <div ref={containerRef} className="absolute inset-0" />
      {!scene && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-300">
          Seleziona o crea una scena per iniziare
        </div>
      )}
      {armed && scene && (
        <div className="pointer-events-none absolute left-3 top-3 rounded bg-pink-600/90 px-2 py-1 text-xs font-medium text-white">
          Clicca sulla panoramica per piazzare un hotspot
        </div>
      )}
    </div>
  );
}

export function captureCurrentView(
  viewer: MarzipanoViewerHandle | null,
): { yaw: number; pitch: number; fov: number } | null {
  const scene = viewer?.scene();
  if (!scene) return null;
  return scene.view().parameters();
}

function buildHotspotElement(spot: MarzipanoHotspot, selected: boolean): HTMLElement {
  const el = document.createElement('div');
  el.dataset.hotspotId = spot.id;
  applyHotspotStyle(el, spot, selected);
  return el;
}

function applyHotspotStyle(el: HTMLElement, spot: MarzipanoHotspot, selected: boolean) {
  const colour =
    spot.type === 'table' ? '#ec4899' : spot.type === 'area' ? '#f59e0b' : '#60a5fa';
  const size = selected ? '44px' : '40px';
  // Set individual properties — never overwrite el.style.cssText because
  // Marzipano writes its positioning transform directly on this element and
  // a cssText assignment wipes it, causing a one-frame jump to (0, 0).
  el.style.width = size;
  el.style.height = size;
  el.style.borderRadius = '50%';
  el.style.background = colour;
  el.style.border = `${selected ? '3px' : '2px'} solid ${selected ? '#ffffff' : 'rgba(255,255,255,0.9)'}`;
  el.style.cursor = 'grab';
  el.style.touchAction = 'none';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.fontSize = '13px';
  el.style.fontWeight = '700';
  el.style.color = 'white';
  el.style.boxShadow = '0 0 0 2px rgba(0,0,0,0.5), 0 3px 8px rgba(0,0,0,0.6)';
  el.style.userSelect = 'none';
  el.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)';
  el.textContent = labelFor(spot);
  el.title = tooltipFor(spot);
}

function labelFor(_spot: MarzipanoHotspot): string {
  return '';
}

function tooltipFor(spot: MarzipanoHotspot): string {
  if (spot.type === 'table') return spot.tableName ? `Tavolo ${spot.tableName}` : 'Tavolo';
  if (spot.type === 'area') return spot.areaName ? `Area ${spot.areaName}` : 'Area';
  return spot.label ?? 'Link scena';
}
