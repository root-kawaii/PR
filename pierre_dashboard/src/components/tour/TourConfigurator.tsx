import { useMemo, useReducer, useState } from 'react';
import type {
  Area,
  MarzipanoHotspot,
  MarzipanoScene,
  MarzipanoView,
  TableResponse,
  TourConfigPayload,
} from '../../types';
import CreateAreaModal from './CreateAreaModal';
import HotspotInspector from './HotspotInspector';
import MarzipanoCanvas from './MarzipanoCanvas';
import SceneList from './SceneList';
import SceneSettingsModal from './SceneSettingsModal';

interface TourConfiguratorProps {
  initialScenes: MarzipanoScene[];
  tables: TableResponse[];
  areas: Area[];
  scope: 'club' | 'event';
  saving: boolean;
  onSave: (payload: TourConfigPayload) => Promise<void> | void;
  isOverriding?: boolean;
  onResetOverride?: () => Promise<void> | void;
  onAreaCreated?: (area: Area) => void;
}

interface ConfiguratorState {
  scenes: MarzipanoScene[];
  selectedSceneId: string | null;
  selectedHotspotId: string | null;
  tablePositions: Record<string, { sceneId: string; yaw: number; pitch: number }>;
  areaPositions: Record<string, { sceneId: string; yaw: number; pitch: number }>;
  dirty: boolean;
}

type Action =
  | { type: 'SELECT_SCENE'; sceneId: string }
  | { type: 'SELECT_HOTSPOT'; hotspotId: string | null }
  | { type: 'ADD_SCENE'; scene: MarzipanoScene }
  | { type: 'UPDATE_SCENE'; sceneId: string; patch: Partial<MarzipanoScene> }
  | { type: 'DELETE_SCENE'; sceneId: string }
  | { type: 'ADD_HOTSPOT'; sceneId: string; hotspot: MarzipanoHotspot }
  | {
      type: 'UPDATE_HOTSPOT';
      sceneId: string;
      hotspotId: string;
      patch: Partial<MarzipanoHotspot>;
    }
  | { type: 'MOVE_HOTSPOT'; sceneId: string; hotspotId: string; yaw: number; pitch: number }
  | { type: 'DELETE_HOTSPOT'; sceneId: string; hotspotId: string };

function hotspotToPosition(hotspot: MarzipanoHotspot, sceneId: string) {
  return { sceneId, yaw: hotspot.yaw, pitch: hotspot.pitch };
}

function syncPositions(state: ConfiguratorState): ConfiguratorState {
  const tablePositions: ConfiguratorState['tablePositions'] = {};
  const areaPositions: ConfiguratorState['areaPositions'] = {};
  state.scenes.forEach((scene) => {
    scene.hotspots.forEach((h) => {
      if (h.type === 'table' && h.tableId) {
        tablePositions[h.tableId] = hotspotToPosition(h, scene.id);
      }
      if (h.type === 'area' && h.areaId) {
        areaPositions[h.areaId] = hotspotToPosition(h, scene.id);
      }
    });
  });
  return { ...state, tablePositions, areaPositions };
}

function reducer(state: ConfiguratorState, action: Action): ConfiguratorState {
  switch (action.type) {
    case 'SELECT_SCENE':
      return { ...state, selectedSceneId: action.sceneId, selectedHotspotId: null };
    case 'SELECT_HOTSPOT':
      return { ...state, selectedHotspotId: action.hotspotId };
    case 'ADD_SCENE':
      return syncPositions({
        ...state,
        scenes: [...state.scenes, action.scene],
        selectedSceneId: action.scene.id,
        selectedHotspotId: null,
        dirty: true,
      });
    case 'UPDATE_SCENE':
      return syncPositions({
        ...state,
        scenes: state.scenes.map((s) =>
          s.id === action.sceneId ? { ...s, ...action.patch } : s,
        ),
        dirty: true,
      });
    case 'DELETE_SCENE': {
      const scenes = state.scenes.filter((s) => s.id !== action.sceneId);
      const cleaned = scenes.map((s) => ({
        ...s,
        hotspots: s.hotspots.filter(
          (h) => !(h.type === 'scene-link' && h.targetSceneId === action.sceneId),
        ),
      }));
      return syncPositions({
        ...state,
        scenes: cleaned,
        selectedSceneId:
          state.selectedSceneId === action.sceneId ? cleaned[0]?.id ?? null : state.selectedSceneId,
        selectedHotspotId: null,
        dirty: true,
      });
    }
    case 'ADD_HOTSPOT':
      return syncPositions({
        ...state,
        scenes: state.scenes.map((s) =>
          s.id === action.sceneId ? { ...s, hotspots: [...s.hotspots, action.hotspot] } : s,
        ),
        selectedHotspotId: action.hotspot.id,
        dirty: true,
      });
    case 'UPDATE_HOTSPOT':
      return syncPositions({
        ...state,
        scenes: state.scenes.map((s) =>
          s.id === action.sceneId
            ? {
                ...s,
                hotspots: s.hotspots.map((h) =>
                  h.id === action.hotspotId ? { ...h, ...action.patch } : h,
                ),
              }
            : s,
        ),
        dirty: true,
      });
    case 'MOVE_HOTSPOT':
      return syncPositions({
        ...state,
        scenes: state.scenes.map((s) =>
          s.id === action.sceneId
            ? {
                ...s,
                hotspots: s.hotspots.map((h) =>
                  h.id === action.hotspotId
                    ? { ...h, yaw: action.yaw, pitch: action.pitch }
                    : h,
                ),
              }
            : s,
        ),
        dirty: true,
      });
    case 'DELETE_HOTSPOT':
      return syncPositions({
        ...state,
        scenes: state.scenes.map((s) =>
          s.id === action.sceneId
            ? { ...s, hotspots: s.hotspots.filter((h) => h.id !== action.hotspotId) }
            : s,
        ),
        selectedHotspotId:
          state.selectedHotspotId === action.hotspotId ? null : state.selectedHotspotId,
        dirty: true,
      });
    default:
      return state;
  }
}

function newSceneId() {
  return `scene-${crypto.randomUUID()}`;
}
function newHotspotId() {
  return `h-${crypto.randomUUID()}`;
}

export default function TourConfigurator({
  initialScenes,
  tables,
  areas: initialAreas,
  scope,
  saving,
  onSave,
  isOverriding,
  onResetOverride,
  onAreaCreated,
}: TourConfiguratorProps) {
  const initialState: ConfiguratorState = useMemo(
    () =>
      syncPositions({
        scenes: initialScenes,
        selectedSceneId: initialScenes[0]?.id ?? null,
        selectedHotspotId: null,
        tablePositions: {},
        areaPositions: {},
        dirty: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialScenes.map((s) => s.id).join(',')],
  );
  const [state, dispatch] = useReducer(reducer, initialState);
  const [areas, setAreas] = useState(initialAreas);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<MarzipanoView | null>(null);
  const [armed, setArmed] = useState(false);
  const [showCreateArea, setShowCreateArea] = useState(false);

  const currentScene = state.scenes.find((s) => s.id === state.selectedSceneId) ?? null;
  const currentHotspot =
    currentScene?.hotspots.find((h) => h.id === state.selectedHotspotId) ?? null;

  const handleAddScene = () => {
    const id = newSceneId();
    dispatch({
      type: 'ADD_SCENE',
      scene: { id, name: `Scena ${state.scenes.length + 1}`, imageUrl: '', hotspots: [] },
    });
    setEditingSceneId(id);
  };

  const handleCanvasClick = (coords: { yaw: number; pitch: number }) => {
    if (!currentScene) return;
    dispatch({
      type: 'ADD_HOTSPOT',
      sceneId: currentScene.id,
      hotspot: {
        id: newHotspotId(),
        type: 'table',
        yaw: coords.yaw,
        pitch: coords.pitch,
      },
    });
    setArmed(false);
  };

  const handleSave = async () => {
    const payload: TourConfigPayload = {
      scenes: state.scenes,
      tablePositions: Object.entries(state.tablePositions).map(([tableId, p]) => ({
        tableId,
        ...p,
      })),
      areaPositions: Object.entries(state.areaPositions).map(([areaId, p]) => ({
        areaId,
        ...p,
      })),
    };
    await onSave(payload);
  };

  return (
    <div className="flex h-[calc(100vh-200px)] flex-col gap-3">
      {scope === 'event' && isOverriding && (
        <div className="flex items-center justify-between rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>
            Questo evento sovrascrive la configurazione del club. Ripristina per tornare a
            ereditare.
          </span>
          {onResetOverride && (
            <button
              type="button"
              onClick={onResetOverride}
              className="rounded border border-amber-400 px-2 py-1 text-xs text-amber-800 hover:bg-amber-100"
            >
              Ripristina ereditata
            </button>
          )}
        </div>
      )}

      <div className="grid flex-1 grid-cols-[260px_1fr_320px] gap-3 overflow-hidden">
        <SceneList
          scenes={state.scenes}
          selectedSceneId={state.selectedSceneId}
          onSelect={(id) => dispatch({ type: 'SELECT_SCENE', sceneId: id })}
          onAddScene={handleAddScene}
          onEditScene={(id) => setEditingSceneId(id)}
          onDeleteScene={(id) => {
            if (confirm('Eliminare questa scena?')) {
              dispatch({ type: 'DELETE_SCENE', sceneId: id });
            }
          }}
        />

        <MarzipanoCanvas
          scene={currentScene && currentScene.imageUrl ? currentScene : null}
          selectedHotspotId={state.selectedHotspotId}
          onCanvasClick={handleCanvasClick}
          armed={armed}
          onHotspotDrag={(hotspotId, coords) => {
            if (!currentScene) return;
            dispatch({
              type: 'MOVE_HOTSPOT',
              sceneId: currentScene.id,
              hotspotId,
              yaw: coords.yaw,
              pitch: coords.pitch,
            });
          }}
          onHotspotSelect={(id) => dispatch({ type: 'SELECT_HOTSPOT', hotspotId: id })}
          onReady={(view) => setCurrentView(view)}
          onViewChange={(view) => setCurrentView(view)}
        />

        <HotspotInspector
          hotspot={currentHotspot}
          scenes={state.scenes}
          currentSceneId={state.selectedSceneId}
          tables={tables}
          areas={areas}
          armed={armed}
          onToggleArm={setArmed}
          onChange={(patch) => {
            if (!currentScene || !currentHotspot) return;
            dispatch({
              type: 'UPDATE_HOTSPOT',
              sceneId: currentScene.id,
              hotspotId: currentHotspot.id,
              patch,
            });
          }}
          onDelete={() => {
            if (!currentScene || !currentHotspot) return;
            dispatch({
              type: 'DELETE_HOTSPOT',
              sceneId: currentScene.id,
              hotspotId: currentHotspot.id,
            });
          }}
          onCreateArea={() => setShowCreateArea(true)}
        />
      </div>

      <div className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-2">
        <div className="text-xs text-gray-600">
          {state.dirty ? (
            <span className="text-amber-700">Modifiche non salvate</span>
          ) : (
            <span>Tutto salvato</span>
          )}
          {' · '}
          {state.scenes.length} scene ·{' '}
          {state.scenes.reduce((n, s) => n + s.hotspots.length, 0)} hotspot
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !state.dirty}
          className="rounded bg-pink-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-pink-700 disabled:opacity-50"
        >
          {saving ? 'Salvataggio…' : 'Salva configurazione'}
        </button>
      </div>

      {editingSceneId && (
        <SceneSettingsModal
          scene={state.scenes.find((s) => s.id === editingSceneId) ?? null}
          currentView={currentView}
          onClose={() => setEditingSceneId(null)}
          onSave={(patch) =>
            dispatch({ type: 'UPDATE_SCENE', sceneId: editingSceneId, patch })
          }
        />
      )}

      {showCreateArea && (
        <CreateAreaModal
          onClose={() => setShowCreateArea(false)}
          onCreated={(area) => {
            setAreas((prev) => [...prev, area]);
            onAreaCreated?.(area);
            if (currentScene && currentHotspot && currentHotspot.type === 'area') {
              dispatch({
                type: 'UPDATE_HOTSPOT',
                sceneId: currentScene.id,
                hotspotId: currentHotspot.id,
                patch: { areaId: area.id, areaName: area.name },
              });
            }
          }}
        />
      )}
    </div>
  );
}
