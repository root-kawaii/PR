import { useState, type FormEvent, useEffect } from 'react';
import { Save, Plus, Trash2, X } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import type { Club, ClubImage } from '../types';

export default function ClubSettingsPage() {
  const { token } = useAuth();
  const { data: club, loading: clubLoading, refetch: refetchClub } = useFetch<Club>('/owner/club');
  const { data: images, loading: imagesLoading, refetch: refetchImages } = useFetch<ClubImage[]>('/owner/club/images');

  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageAlt, setNewImageAlt] = useState('');
  const [addingImage, setAddingImage] = useState(false);
  const [showAddImage, setShowAddImage] = useState(false);

  useEffect(() => {
    if (club) {
      setName(club.name ?? '');
      setSubtitle(club.subtitle ?? '');
      setAddress(club.address ?? '');
      setPhone(club.phone_number ?? '');
      setWebsite(club.website ?? '');
    }
  }, [club]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`${API_URL}/owner/club`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          subtitle,
          address: address || undefined,
          phone_number: phone || undefined,
          website: website || undefined,
        }),
      });
      if (!res.ok) throw new Error('Errore nel salvataggio');
      setSaveSuccess(true);
      refetchClub();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore');
    } finally {
      setSaving(false);
    }
  };

  const handleAddImage = async (e: FormEvent) => {
    e.preventDefault();
    setAddingImage(true);
    try {
      const res = await fetch(`${API_URL}/owner/club/images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: newImageUrl,
          alt_text: newImageAlt || undefined,
          display_order: (images ?? []).length,
        }),
      });
      if (!res.ok) throw new Error('Errore nel caricamento');
      setNewImageUrl('');
      setNewImageAlt('');
      setShowAddImage(false);
      refetchImages();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore');
    } finally {
      setAddingImage(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Rimuovere questa immagine?')) return;
    try {
      const res = await fetch(`${API_URL}/owner/club/images/${imageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Errore nella rimozione');
      refetchImages();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore');
    }
  };

  if (clubLoading) {
    return <div className="text-gray-500">Caricamento...</div>;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Impostazioni Locale</h1>

      {/* Info form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Informazioni</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sottotitolo</label>
              <input
                value={subtitle}
                onChange={e => setSubtitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo</label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Via Roma 1, Milano"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+39 02 1234567"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sito web</label>
              <input
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              <Save size={16} />
              {saving ? 'Salvataggio...' : 'Salva'}
            </button>
            {saveSuccess && (
              <span className="text-green-600 text-sm font-medium">Salvato con successo!</span>
            )}
          </div>
        </form>
      </div>

      {/* Gallery */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Galleria Immagini</h2>
          <button
            onClick={() => setShowAddImage(true)}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition-colors"
          >
            <Plus size={16} />
            Aggiungi
          </button>
        </div>

        {showAddImage && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Nuova immagine</h3>
                <button onClick={() => setShowAddImage(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddImage} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL immagine</label>
                  <input
                    value={newImageUrl}
                    onChange={e => setNewImageUrl(e.target.value)}
                    required
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione (opzionale)</label>
                  <input
                    value={newImageAlt}
                    onChange={e => setNewImageAlt(e.target.value)}
                    placeholder="Sala principale"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
                  />
                </div>
                <button
                  type="submit"
                  disabled={addingImage}
                  className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {addingImage ? 'Aggiungendo...' : 'Aggiungi'}
                </button>
              </form>
            </div>
          </div>
        )}

        {imagesLoading ? (
          <p className="text-gray-500 text-sm">Caricamento...</p>
        ) : !(images ?? []).length ? (
          <p className="text-gray-500 text-sm">Nessuna immagine. Aggiungi la prima immagine del locale.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(images ?? []).map((img) => (
              <div key={img.id} className="relative group rounded-lg overflow-hidden aspect-video bg-gray-100">
                <img src={img.url} alt={img.alt_text ?? ''} className="w-full h-full object-cover" />
                <button
                  onClick={() => handleDeleteImage(img.id)}
                  className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
                {img.alt_text && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 truncate">
                    {img.alt_text}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
