import { useState, type FormEvent, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import type {
  Club,
  ClubImage,
  StripeConnectStatus,
  StripeOnboardingLinkResponse,
} from '../types';
import { trackEvent } from '../config/analytics';

interface ClubImageApiRow {
  id: string;
  club_id?: string;
  clubId?: string;
  url: string;
  display_order?: number;
  displayOrder?: number;
  alt_text?: string | null;
  altText?: string | null;
}

interface ClubImagesData {
  images?: ClubImageApiRow[];
}

type StripeTone = 'slate' | 'green' | 'amber' | 'rose';

type ClubImagesResponse = ClubImageApiRow[] | ClubImagesData | null;

type RawStripeStatus = Partial<StripeConnectStatus & {
  connectedAccountId?: string | null;
  onboardingComplete?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
}>;

interface ApiErrorResponse {
  error?: string;
  code?: string;
}

export default function ClubSettingsPage() {
  const { token } = useAuth();
  const {
    data: club,
    loading: clubLoading,
    refetch: refetchClub,
  } = useFetch<Club>('/owner/club');
  const {
    data: imagesData,
    loading: imagesLoading,
    refetch: refetchImages,
  } = useFetch<ClubImagesResponse>('/owner/club/images');
  const {
    data: stripeStatus,
    loading: stripeLoading,
    refetch: refetchStripeStatus,
  } = useFetch<RawStripeStatus>('/owner/club/stripe/status');

  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [startingOnboarding, setStartingOnboarding] = useState(false);

  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageAlt, setNewImageAlt] = useState('');
  const [addingImage, setAddingImage] = useState(false);
  const [showAddImage, setShowAddImage] = useState(false);

  const clubImages = useMemo<ClubImage[]>(() => {
    const rawImages = Array.isArray(imagesData)
      ? imagesData
      : imagesData?.images ?? [];

    return rawImages.map((image) => ({
      id: image.id,
      clubId: image.clubId ?? image.club_id ?? '',
      url: image.url,
      displayOrder: image.displayOrder ?? image.display_order ?? 0,
      altText: image.altText ?? image.alt_text ?? undefined,
    }));
  }, [imagesData]);

  const normalizedStripeStatus = useMemo<StripeConnectStatus>(() => {
    const rawStripeStatus = stripeStatus ?? {};

    return {
      connected_account_id:
        rawStripeStatus.connected_account_id ?? rawStripeStatus.connectedAccountId ?? null,
      onboarding_complete:
        rawStripeStatus.onboarding_complete ?? rawStripeStatus.onboardingComplete ?? false,
      charges_enabled:
        rawStripeStatus.charges_enabled ?? rawStripeStatus.chargesEnabled ?? false,
      payouts_enabled:
        rawStripeStatus.payouts_enabled ?? rawStripeStatus.payoutsEnabled ?? false,
      details_submitted:
        rawStripeStatus.details_submitted ?? rawStripeStatus.detailsSubmitted ?? false,
      platform_commission_percent: null,
      platform_commission_fixed_fee: null,
    };
  }, [stripeStatus]);

  useEffect(() => {
    if (!club) {
      return;
    }

    setName(club.name ?? '');
    setSubtitle(club.subtitle ?? '');
    setAddress(club.address ?? '');
    setPhone(club.phone_number ?? '');
    setWebsite(club.website ?? '');
  }, [club]);

  useEffect(() => {
    if (clubLoading || !club) {
      return;
    }

    trackEvent('owner_club_settings_viewed', {
      club_id: club.id,
      image_count: clubImages.length,
      stripe_connected: Boolean(normalizedStripeStatus.connected_account_id),
    });
  }, [club, clubLoading, clubImages.length, normalizedStripeStatus.connected_account_id]);

  const stripeToneClasses: Record<StripeTone, string> = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    rose: 'bg-rose-100 text-rose-700 border-rose-200',
  };

  const stripeState = useMemo(() => {
    if (!normalizedStripeStatus.connected_account_id) {
      return {
        label: 'Non collegato',
        tone: 'slate' as StripeTone,
        description:
          'Crea un account Stripe Connect per instradare automaticamente la quota del locale.',
      };
    }

    if (normalizedStripeStatus.charges_enabled && normalizedStripeStatus.payouts_enabled) {
      return {
        label: 'Pronto per i payout',
        tone: 'green' as StripeTone,
        description:
          'L’account Stripe del locale e attivo e puo ricevere la sua quota in automatico.',
      };
    }

    if (normalizedStripeStatus.details_submitted || normalizedStripeStatus.onboarding_complete) {
      return {
        label: 'Verifica in corso',
        tone: 'amber' as StripeTone,
        description:
          'Stripe ha ricevuto i dati. Appena verifica e payout saranno abilitati, i pagamenti verranno instradati in automatico.',
      };
    }

    return {
      label: 'Onboarding incompleto',
      tone: 'rose' as StripeTone,
      description:
        'Il locale ha un account collegato ma deve completare il flusso Stripe per ricevere i payout.',
    };
  }, [normalizedStripeStatus]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    trackEvent('owner_club_update_submitted', {
      has_phone: Boolean(phone),
      has_website: Boolean(website),
    });

    try {
      const res = await fetch(`${API_URL}/owner/club`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          subtitle,
          address: address || undefined,
          phone_number: phone || undefined,
          website: website || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('Errore nel salvataggio');
      }

      trackEvent('owner_club_updated', {
        club_id: club?.id ?? null,
      });

      setSaveSuccess(true);
      refetchClub();
      refetchStripeStatus();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      trackEvent('owner_club_update_failed', {
        club_id: club?.id ?? null,
        error_message: err instanceof Error ? err.message : 'Errore',
      });
      alert(err instanceof Error ? err.message : 'Errore');
    } finally {
      setSaving(false);
    }
  };

  const handleStartStripeOnboarding = async () => {
    setStartingOnboarding(true);

    trackEvent('owner_stripe_connect_started', {
      club_id: club?.id ?? null,
      existing_account: normalizedStripeStatus.connected_account_id ?? null,
    });

    try {
      const res = await fetch(`${API_URL}/owner/club/stripe/connect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        let message = `Errore avvio onboarding Stripe (HTTP ${res.status})`;
        const responseText = (await res.text()).trim();

        try {
          const errorData = JSON.parse(responseText) as ApiErrorResponse;
          if (errorData.error) {
            message = errorData.error;
            if (errorData.code) {
              message += ` [${errorData.code}]`;
            }
          }
        } catch {
          if (responseText) {
            message = `${message}: ${responseText}`;
          }
        }

        throw new Error(message);
      }

      const data: StripeOnboardingLinkResponse = await res.json();
      window.location.href = data.onboarding_url;
    } catch (err) {
      trackEvent('owner_stripe_connect_failed', {
        club_id: club?.id ?? null,
        error_message: err instanceof Error ? err.message : 'Errore',
      });
      alert(err instanceof Error ? err.message : 'Errore');
    } finally {
      setStartingOnboarding(false);
    }
  };

  const handleAddImage = async (e: FormEvent) => {
    e.preventDefault();
    setAddingImage(true);

    trackEvent('owner_club_image_add_submitted', {
      club_id: club?.id ?? null,
    });

    try {
      const res = await fetch(`${API_URL}/owner/club/images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: newImageUrl,
          alt_text: newImageAlt || undefined,
          display_order: clubImages.length,
        }),
      });

      if (!res.ok) {
        throw new Error('Errore nel caricamento');
      }

      trackEvent('owner_club_image_added', {
        club_id: club?.id ?? null,
      });

      setNewImageUrl('');
      setNewImageAlt('');
      setShowAddImage(false);
      refetchImages();
    } catch (err) {
      trackEvent('owner_club_image_add_failed', {
        club_id: club?.id ?? null,
        error_message: err instanceof Error ? err.message : 'Errore',
      });
      alert(err instanceof Error ? err.message : 'Errore');
    } finally {
      setAddingImage(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Rimuovere questa immagine?')) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/owner/club/images/${imageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Errore nella rimozione');
      }

      trackEvent('owner_club_image_deleted', {
        club_id: club?.id ?? null,
        image_id: imageId,
      });
      refetchImages();
    } catch (err) {
      trackEvent('owner_club_image_delete_failed', {
        club_id: club?.id ?? null,
        image_id: imageId,
        error_message: err instanceof Error ? err.message : 'Errore',
      });
      alert(err instanceof Error ? err.message : 'Errore');
    }
  };

  if (clubLoading) {
    return <div className="text-gray-500">Caricamento...</div>;
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Impostazioni Locale</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-gray-900 text-white flex items-center justify-center">
                <CreditCard size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Stripe Connect</h2>
                <p className="text-sm text-gray-500">
                  Ogni locale puo collegare il proprio account Stripe e ricevere payout automatici.
                </p>
              </div>
            </div>

            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${stripeToneClasses[stripeState.tone]}`}
            >
              {stripeState.tone === 'green' ? (
                <CheckCircle2 size={15} />
              ) : (
                <AlertCircle size={15} />
              )}
              {stripeState.label}
            </div>

            <p className="text-sm text-gray-600 mt-3">{stripeState.description}</p>

            {normalizedStripeStatus.connected_account_id && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Account ID
                  </div>
                  <div className="text-sm font-mono text-gray-900 break-all">
                    {normalizedStripeStatus.connected_account_id}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Charges
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {normalizedStripeStatus.charges_enabled ? 'Abilitati' : 'Non abilitati'}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Payouts
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {normalizedStripeStatus.payouts_enabled ? 'Abilitati' : 'Non abilitati'}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => refetchStripeStatus()}
              disabled={stripeLoading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={16} className={stripeLoading ? 'animate-spin' : ''} />
              Aggiorna stato
            </button>
            <button
              type="button"
              onClick={handleStartStripeOnboarding}
              disabled={startingOnboarding}
              className="flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              <ExternalLink size={16} />
              {startingOnboarding
                ? 'Apertura...'
                : normalizedStripeStatus.connected_account_id
                  ? 'Continua onboarding'
                  : 'Collega Stripe'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Informazioni e commissioni</h2>
        <form onSubmit={handleSave} className="space-y-5">
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
              <span className="text-green-600 text-sm font-medium">
                Salvato con successo!
              </span>
            )}
          </div>
        </form>
      </div>

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
                <button
                  onClick={() => setShowAddImage(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddImage} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL immagine
                  </label>
                  <input
                    value={newImageUrl}
                    onChange={e => setNewImageUrl(e.target.value)}
                    required
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrizione (opzionale)
                  </label>
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
        ) : clubImages.length === 0 ? (
          <p className="text-gray-500 text-sm">
            Nessuna immagine. Aggiungi la prima immagine del locale.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {clubImages.map((img) => (
              <div
                key={img.id}
                className="relative group rounded-lg overflow-hidden aspect-video bg-gray-100"
              >
                <img
                  src={img.url}
                  alt={img.altText ?? ''}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => handleDeleteImage(img.id)}
                  className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
                {img.altText && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 truncate">
                    {img.altText}
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
