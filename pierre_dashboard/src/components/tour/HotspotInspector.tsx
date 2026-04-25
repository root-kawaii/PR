import { Trash2 } from 'lucide-react';
import type {
  Area,
  MarzipanoHotspot,
  MarzipanoHotspotType,
  MarzipanoScene,
  TableResponse,
} from '../../types';

interface HotspotInspectorProps {
  hotspot: MarzipanoHotspot | null;
  scenes: MarzipanoScene[];
  currentSceneId: string | null;
  tables: TableResponse[];
  areas: Area[];
  onChange: (patch: Partial<MarzipanoHotspot>) => void;
  onDelete: () => void;
  onCreateArea: () => void;
  armed: boolean;
  onToggleArm: (armed: boolean) => void;
}

const HOTSPOT_TYPES: Array<{ value: MarzipanoHotspotType; label: string }> = [
  { value: 'table', label: 'Tavolo' },
  { value: 'area', label: 'Area' },
  { value: 'scene-link', label: 'Link a scena' },
];

export default function HotspotInspector({
  hotspot,
  scenes,
  currentSceneId,
  tables,
  areas,
  onChange,
  onDelete,
  onCreateArea,
  armed,
  onToggleArm,
}: HotspotInspectorProps) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Hotspot</h3>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <label className="flex items-center gap-2 rounded border border-dashed border-pink-300 bg-pink-50 px-3 py-2 text-xs text-pink-800">
          <input
            type="checkbox"
            checked={armed}
            onChange={(e) => onToggleArm(e.target.checked)}
            className="accent-pink-600"
          />
          Aggiungi nuovo hotspot al click
        </label>

        {!hotspot ? (
          <p className="text-xs text-gray-500">
            Nessun hotspot selezionato. Cliccane uno sulla panoramica o attiva
            l'aggiunta e posizionane uno nuovo.
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Tipo</label>
              <select
                value={hotspot.type}
                onChange={(e) => onChange({ type: e.target.value as MarzipanoHotspotType })}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                {HOTSPOT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {hotspot.type === 'table' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Tavolo</label>
                <select
                  value={hotspot.tableId ?? ''}
                  onChange={(e) => {
                    const t = tables.find((x) => x.id === e.target.value);
                    onChange({ tableId: e.target.value || undefined, tableName: t?.name });
                  }}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">— seleziona —</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.zone ? ` (${t.zone})` : ''}
                    </option>
                  ))}
                </select>
                {tables.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    Nessun tavolo disponibile. Creali nella pagina Tavoli evento.
                  </p>
                )}
              </div>
            )}

            {hotspot.type === 'area' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Area</label>
                <div className="flex gap-2">
                  <select
                    value={hotspot.areaId ?? ''}
                    onChange={(e) => {
                      const a = areas.find((x) => x.id === e.target.value);
                      onChange({ areaId: e.target.value || undefined, areaName: a?.name });
                    }}
                    className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">— seleziona —</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={onCreateArea}
                    className="rounded border border-pink-600 px-2 py-1 text-xs text-pink-600 hover:bg-pink-50"
                  >
                    Nuova
                  </button>
                </div>
              </div>
            )}

            {hotspot.type === 'scene-link' && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Scena target
                  </label>
                  <select
                    value={hotspot.targetSceneId ?? ''}
                    onChange={(e) => onChange({ targetSceneId: e.target.value || undefined })}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">— seleziona —</option>
                    {scenes
                      .filter((s) => s.id !== currentSceneId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Etichetta
                  </label>
                  <input
                    type="text"
                    value={hotspot.label ?? ''}
                    onChange={(e) => onChange({ label: e.target.value })}
                    placeholder="es. → Zona VIP"
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
              <div>
                <div className="font-medium text-gray-700">Yaw</div>
                <div>{hotspot.yaw.toFixed(3)} rad</div>
              </div>
              <div>
                <div className="font-medium text-gray-700">Pitch</div>
                <div>{hotspot.pitch.toFixed(3)} rad</div>
              </div>
            </div>

            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Elimina hotspot
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
