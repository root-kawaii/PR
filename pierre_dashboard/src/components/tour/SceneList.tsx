import { Plus, Settings, Trash2 } from 'lucide-react';
import type { MarzipanoScene } from '../../types';

interface SceneListProps {
  scenes: MarzipanoScene[];
  selectedSceneId: string | null;
  onSelect: (sceneId: string) => void;
  onAddScene: () => void;
  onEditScene: (sceneId: string) => void;
  onDeleteScene: (sceneId: string) => void;
}

export default function SceneList({
  scenes,
  selectedSceneId,
  onSelect,
  onAddScene,
  onEditScene,
  onDeleteScene,
}: SceneListProps) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Scene</h3>
        <button
          type="button"
          onClick={onAddScene}
          className="inline-flex items-center gap-1 rounded bg-pink-600 px-2 py-1 text-xs font-medium text-white hover:bg-pink-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuova
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {scenes.length === 0 ? (
          <li className="px-4 py-6 text-center text-xs text-gray-500">
            Nessuna scena. Inizia creandone una.
          </li>
        ) : (
          scenes.map((scene) => (
            <li
              key={scene.id}
              className={`group flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-2 text-sm ${
                selectedSceneId === scene.id ? 'bg-pink-50' : 'hover:bg-gray-50'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(scene.id)}
                className="flex-1 truncate text-left"
              >
                <div className="truncate font-medium text-gray-900">{scene.name}</div>
                <div className="text-xs text-gray-500">
                  {scene.hotspots.length} hotspot
                </div>
              </button>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => onEditScene(scene.id)}
                  className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                  title="Modifica scena"
                >
                  <Settings className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteScene(scene.id)}
                  className="rounded p-1 text-gray-500 hover:bg-red-50 hover:text-red-600"
                  title="Elimina scena"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
