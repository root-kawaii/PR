import { X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import type { MarzipanoScene, MarzipanoView } from '../../types';

interface SceneSettingsModalProps {
  scene: MarzipanoScene | null;
  currentView: MarzipanoView | null;
  onClose: () => void;
  onSave: (patch: Partial<MarzipanoScene>) => void;
}

export default function SceneSettingsModal({
  scene,
  currentView,
  onClose,
  onSave,
}: SceneSettingsModalProps) {
  const { token } = useAuth();
  const [name, setName] = useState(scene?.name ?? '');
  const [imageUrl, setImageUrl] = useState(scene?.imageUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!scene) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`${API_URL}/owner/uploads/panorama`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { publicUrl: string; objectKey: string };
      setImageUrl(json.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fallito');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave({ name: name.trim(), imageUrl: (imageUrl ?? '').trim() });
    onClose();
  };

  const handleUseCurrentView = () => {
    if (!currentView) return;
    onSave({ initialView: currentView });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-900">Impostazioni scena</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Immagine 360° (equirettangolare)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploading}
              className="block w-full text-xs file:mr-3 file:rounded file:border-0 file:bg-pink-600 file:px-3 file:py-1.5 file:text-xs file:text-white hover:file:bg-pink-700"
            />
            {uploading && (
              <p className="mt-1 text-xs text-gray-500">Caricamento in corso…</p>
            )}
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://… (o usa l'upload qui sopra)"
              required
              className="mt-2 w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          </div>

          <div className="rounded border border-gray-200 p-3 text-xs">
            <div className="mb-2 font-medium text-gray-700">Vista iniziale</div>
            {scene.initialView ? (
              <div className="text-gray-600">
                yaw {scene.initialView.yaw.toFixed(2)} · pitch{' '}
                {scene.initialView.pitch.toFixed(2)} · fov{' '}
                {((scene.initialView.fov * 180) / Math.PI).toFixed(0)}°
              </div>
            ) : (
              <div className="text-gray-500">Non impostata (default: 0, 0, 90°).</div>
            )}
            <button
              type="button"
              onClick={handleUseCurrentView}
              disabled={!currentView}
              className="mt-2 rounded border border-pink-600 px-2 py-1 text-xs text-pink-600 hover:bg-pink-50 disabled:opacity-50"
            >
              Usa vista corrente come iniziale
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="rounded bg-pink-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-pink-700 disabled:opacity-50"
            >
              Salva
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
