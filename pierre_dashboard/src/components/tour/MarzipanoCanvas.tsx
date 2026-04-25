import { useEffect, useRef } from 'react';
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
  }, [scene, onReady]);

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
        existing.setPosition({ yaw: spot.yaw, pitch: spot.pitch });
        const el = existing.domElement();
        applyHotspotStyle(el, spot, spot.id === selectedHotspotId);
        return;
      }
      const el = buildHotspotElement(spot, spot.id === selectedHotspotId);
      const handle = container.createHotspot(el, { yaw: spot.yaw, pitch: spot.pitch });
      attachHotspotInteractions(el, spot.id, handle, entry.sceneHandle);
      entry.hotspotHandles.set(spot.id, handle);
    });
  }, [scene, selectedHotspotId]);

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

    const onPointerDown = (e: PointerEvent) => {
      e.stopPropagation();
      dragging = true;
      moved = false;
      el.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const container = containerRef.current;
      if (!container) return;
      moved = true;
      const rect = container.getBoundingClientRect();
      const coords = sceneHandle
        .view()
        .screenToCoordinates({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      handle.setPosition(coords);
      onHotspotDragRef.current?.(hotspotId, coords);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
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
    spot.type === 'table' ? '#ec4899' : spot.type === 'area' ? '#f59e0b' : '#3b82f6';
  const ring = selected ? '3px solid white' : '2px solid rgba(255,255,255,0.7)';
  el.style.cssText = `
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: ${colour};
    border: ${ring};
    cursor: grab;
    touch-action: none;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    color: white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    user-select: none;
  `;
  el.textContent = labelFor(spot);
  el.title = tooltipFor(spot);
}

function labelFor(spot: MarzipanoHotspot): string {
  if (spot.type === 'table') return 'T';
  if (spot.type === 'area') return 'A';
  return '→';
}

function tooltipFor(spot: MarzipanoHotspot): string {
  if (spot.type === 'table') return spot.tableName ? `Tavolo ${spot.tableName}` : 'Tavolo';
  if (spot.type === 'area') return spot.areaName ? `Area ${spot.areaName}` : 'Area';
  return spot.label ?? 'Link scena';
}
