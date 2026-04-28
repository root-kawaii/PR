import { useRef, useState } from 'react';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { getSafeImageUrl } from '../utils/image';

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

interface EventImageUploadProps {
  currentUrl?: string;
  onUploaded: (url: string) => void;
}

export default function EventImageUpload({ currentUrl, onUploaded }: EventImageUploadProps) {
  const { token } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const previewSrc = getSafeImageUrl(preview, { allowBlob: true });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview before upload
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploadState('uploading');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_URL}/owner/events/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Upload fallito');
      }

      const data = await res.json() as { url: string };
      setPreview(data.url);
      setUploadState('done');
      onUploaded(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante l\'upload');
      setUploadState('error');
    }
  };

  return (
    <div>
      {previewSrc ? (
        <div className="relative w-full h-40 rounded-lg overflow-hidden border border-gray-200 mb-2">
          <img src={previewSrc} alt="Locandina" className="w-full h-full object-cover" />
          {uploadState === 'uploading' && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-2 right-2 bg-white text-gray-800 text-xs px-2 py-1 rounded shadow hover:bg-gray-100"
          >
            Cambia
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-40 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
        >
          {uploadState === 'uploading' ? (
            <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm">Clicca per caricare la locandina</span>
              <span className="text-xs mt-1">JPG, PNG, WEBP — max 5 MB</span>
            </>
          )}
        </button>
      )}

      {error && (
        <p className="text-red-500 text-xs mt-1">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
