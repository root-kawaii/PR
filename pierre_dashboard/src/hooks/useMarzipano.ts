import { useEffect, useState } from 'react';

// We load the Marzipano library via <script> tag from /marzipano.js (see public/).
// This keeps us on the exact same version used by the mobile viewer so yaw/pitch
// coordinates are portable between editor and runtime.

declare global {
  interface Window {
    Marzipano?: MarzipanoGlobal;
    __MARZIPANO_LOADING__?: Promise<void>;
  }
}

export interface MarzipanoGlobal {
  Viewer: new (el: HTMLElement, opts?: Record<string, unknown>) => MarzipanoViewerHandle;
  ImageUrlSource: { fromString: (url: string) => unknown };
  EquirectGeometry: new (levels: Array<{ width: number }>) => unknown;
  RectilinearView: {
    new (
      params: { yaw: number; pitch: number; fov: number },
      limiter: unknown,
    ): MarzipanoViewHandle;
    limit: {
      traditional: (maxFaceSize: number, maxVFov: number) => unknown;
    };
  };
}

export interface MarzipanoViewHandle {
  screenToCoordinates: (screen: { x: number; y: number }) => { yaw: number; pitch: number };
  parameters: () => { yaw: number; pitch: number; fov: number };
  setParameters: (p: { yaw: number; pitch: number; fov: number }) => void;
}

export interface MarzipanoSceneHandle {
  switchTo: (opts?: { transitionDuration?: number }) => void;
  view: () => MarzipanoViewHandle;
  hotspotContainer: () => MarzipanoHotspotContainer;
  destroy: () => void;
}

export interface MarzipanoHotspotHandle {
  setPosition: (p: { yaw: number; pitch: number }) => void;
  destroy: () => void;
  domElement: () => HTMLElement;
}

export interface MarzipanoHotspotContainer {
  createHotspot: (
    el: HTMLElement,
    position: { yaw: number; pitch: number },
  ) => MarzipanoHotspotHandle;
}

export interface MarzipanoViewerHandle {
  createScene: (opts: {
    source: unknown;
    geometry: unknown;
    view: MarzipanoViewHandle;
    pinFirstLevel?: boolean;
  }) => MarzipanoSceneHandle;
  scene: () => MarzipanoSceneHandle | null;
  destroy: () => void;
  domElement: () => HTMLElement;
}

function loadMarzipano(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.Marzipano) return Promise.resolve();
  if (window.__MARZIPANO_LOADING__) return window.__MARZIPANO_LOADING__;

  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-marzipano]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Marzipano failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.src = '/marzipano.js';
    script.async = true;
    script.dataset.marzipano = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Marzipano failed to load'));
    document.head.appendChild(script);
  });

  window.__MARZIPANO_LOADING__ = promise;
  return promise;
}

export function useMarzipano(): { ready: boolean; error: string | null } {
  const [ready, setReady] = useState<boolean>(!!window.Marzipano);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (window.Marzipano) {
      setReady(true);
      return;
    }
    let cancelled = false;
    loadMarzipano()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ready, error };
}

export function createViewer(container: HTMLElement): MarzipanoViewerHandle {
  const Marzipano = window.Marzipano;
  if (!Marzipano) throw new Error('Marzipano not loaded');
  return new Marzipano.Viewer(container, {
    controls: { mouseViewMode: 'drag' },
  }) as MarzipanoViewerHandle;
}

export function createSceneFromUrl(
  viewer: MarzipanoViewerHandle,
  imageUrl: string,
  initialView?: { yaw: number; pitch: number; fov: number },
): MarzipanoSceneHandle {
  const Marzipano = window.Marzipano;
  if (!Marzipano) throw new Error('Marzipano not loaded');
  const source = Marzipano.ImageUrlSource.fromString(imageUrl);
  const geometry = new Marzipano.EquirectGeometry([{ width: 4096 }]);
  const limiter = Marzipano.RectilinearView.limit.traditional(4096, (100 * Math.PI) / 180);
  const view = new Marzipano.RectilinearView(
    initialView ?? { yaw: 0, pitch: 0, fov: Math.PI / 2 },
    limiter,
  );
  return viewer.createScene({ source, geometry, view, pinFirstLevel: true });
}
