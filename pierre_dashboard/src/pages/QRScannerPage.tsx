import { useState, useEffect, useRef } from 'react';
import { Search, CheckCircle, XCircle, AlertCircle, UserCheck, X } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import type { ScanResult } from '../types';
import { trackEvent } from '../config/analytics';
import { PageHeader, SectionCard } from '../components/ui';
import { ui } from '../components/ui-classes';

type ScanStatus = 'idle' | 'loading' | 'valid' | 'used' | 'invalid';

export default function QRScannerPage() {
  const { token } = useAuth();
  const [manualCode, setManualCode] = useState('');
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinDone, setCheckinDone] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html5QrRef = useRef<any>(null);

  const handleScan = async (code: string, source: 'manual' | 'camera') => {
    const trimmed = code.trim();
    if (!trimmed) return;
    trackEvent('owner_scan_submitted', {
      source,
      code_length: trimmed.length,
    });
    setScanStatus('loading');
    setResult(null);
    setCheckinDone(false);
    try {
      const res = await fetch(`${API_URL}/owner/scan/${encodeURIComponent(trimmed)}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data: ScanResult = await res.json();
      setResult(data);
      trackEvent('owner_scan_resolved', {
        source,
        valid: data.valid,
        already_used: data.alreadyUsed,
        scan_type: data.scanType,
      });
      if (!data.valid || data.scanType === 'unknown') {
        setScanStatus('invalid');
      } else if (data.alreadyUsed) {
        setScanStatus('used');
      } else {
        setScanStatus('valid');
      }
    } catch {
      trackEvent('owner_scan_failed', {
        source,
      });
      setScanStatus('invalid');
      setResult({ valid: false, alreadyUsed: false, scanType: 'unknown', code: trimmed });
    }
  };

  const handleCheckin = async () => {
    if (!result) return;
    setCheckinLoading(true);
    trackEvent('owner_checkin_submitted', {
      code: result.code,
      scan_type: result.scanType,
    });
    try {
      const res = await fetch(`${API_URL}/owner/checkin/${encodeURIComponent(result.code)}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Errore check-in');
      trackEvent('owner_checkin_completed', {
        code: result.code,
        scan_type: result.scanType,
      });
      setCheckinDone(true);
      setScanStatus('used');
    } catch (err) {
      trackEvent('owner_checkin_failed', {
        code: result.code,
        scan_type: result.scanType,
        error_message: err instanceof Error ? err.message : 'Errore',
      });
      alert(err instanceof Error ? err.message : 'Errore');
    } finally {
      setCheckinLoading(false);
    }
  };

  const handleReset = () => {
    setManualCode('');
    setScanStatus('idle');
    setResult(null);
    setCheckinDone(false);
  };

  const startCamera = async () => {
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    const elementId = isMobile ? 'qr-reader-modal' : 'qr-reader-inline';

    if (isMobile) setShowCameraModal(true);
    setCameraActive(true);
    setCameraError(null);

    // Wait one frame so the target div is rendered before html5-qrcode mounts into it
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

    try {
      const scanner = new Html5Qrcode(elementId);
      html5QrRef.current = scanner;
      trackEvent('owner_camera_scan_started');

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          scanner.stop().catch(() => {});
          html5QrRef.current = null;
          setCameraActive(false);
          setShowCameraModal(false);
          handleScan(decodedText, 'camera');
        },
        undefined,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCameraError(`Impossibile accedere alla fotocamera: ${msg}`);
      setCameraActive(false);
      setShowCameraModal(false);
      trackEvent('owner_camera_scan_failed');
    }
  };

  const stopCamera = async () => {
    if (html5QrRef.current) {
      try {
        await html5QrRef.current.stop();
      } catch {
        // ignore
      }
      html5QrRef.current = null;
    }
    setCameraActive(false);
    setShowCameraModal(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Scanner QR"
        description="Controlla rapidamente biglietti e prenotazioni tavolo con fotocamera o inserimento manuale."
      />

      {/* Camera scanner */}
      <SectionCard className="mb-4 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Scansione con fotocamera</h2>

        {cameraError && (
          <p className="text-sm text-red-600 mb-3">{cameraError}</p>
        )}

        {/* Inline viewer — desktop only */}
        <div
          id="qr-reader-inline"
          className="relative rounded-lg overflow-hidden"
          style={cameraActive && !showCameraModal
            ? { minHeight: '300px', marginBottom: '1rem' }
            : { width: '1px', height: '1px', overflow: 'hidden', opacity: 0, position: 'absolute' }}
        />

        {!cameraActive ? (
          <button
            onClick={startCamera}
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 py-8 text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
          >
            <Search size={20} />
            <span>Avvia fotocamera</span>
          </button>
        ) : !showCameraModal ? (
          <button
            onClick={stopCamera}
            className="flex min-h-10 w-full items-center justify-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
          >
            <X size={16} />
            Ferma fotocamera
          </button>
        ) : null}
      </SectionCard>

      {/* Manual input */}
      <SectionCard className="mb-4 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Inserimento manuale</h2>
        <form
          onSubmit={(e) => { e.preventDefault(); handleScan(manualCode, 'manual'); }}
          className="flex gap-2"
        >
          <input
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            placeholder="Inserisci codice prenotazione o biglietto"
            className={`${ui.input} ${ui.tabularNums} flex-1 font-mono`}
          />
          <button
            type="submit"
            disabled={!manualCode.trim() || scanStatus === 'loading'}
            className={ui.primaryButton}
          >
            <Search size={16} />
            Verifica
          </button>
        </form>
      </SectionCard>

      {/* Result */}
      {scanStatus !== 'idle' && (
        <SectionCard className={`border-2 p-6 ${
          scanStatus === 'valid' ? 'border-green-400 bg-green-50' :
          scanStatus === 'used' ? 'border-amber-400 bg-amber-50' :
          scanStatus === 'loading' ? 'border-gray-200 bg-white' :
          'border-red-400 bg-red-50'
        }`}>
          {scanStatus === 'loading' && (
            <div className="flex items-center gap-3 text-gray-500">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
              <span>Verifica in corso...</span>
            </div>
          )}

          {scanStatus === 'valid' && result && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle size={28} className="text-green-600" />
                <span className="text-xl font-bold text-green-700">Codice valido</span>
              </div>
              <ScanResultDetails result={result} />
              {!checkinDone ? (
                <button
                  onClick={handleCheckin}
                  disabled={checkinLoading}
                  className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                >
                  <UserCheck size={18} />
                  {checkinLoading ? 'Registrazione...' : 'Segna come entrato'}
                </button>
              ) : (
                <div className="mt-4 flex items-center gap-2 text-green-700 font-medium">
                  <CheckCircle size={18} />
                  Check-in completato
                </div>
              )}
            </div>
          )}

          {scanStatus === 'used' && result && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle size={28} className="text-amber-600" />
                <span className="text-xl font-bold text-amber-700">
                  {checkinDone ? 'Check-in appena registrato' : 'Codice gia utilizzato'}
                </span>
              </div>
              <ScanResultDetails result={result} />
            </div>
          )}

          {scanStatus === 'invalid' && (
            <div className="flex items-center gap-2">
              <XCircle size={28} className="text-red-600" />
              <span className="text-xl font-bold text-red-700">Codice non valido</span>
            </div>
          )}

          <button
            onClick={handleReset}
            className="mt-4 text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Nuova scansione
          </button>
        </SectionCard>
      )}

      {/* Mobile fullscreen camera modal */}
      {showCameraModal && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 shrink-0">
            <span className="text-white font-semibold">Scansione QR</span>
            <button onClick={stopCamera} className="inline-flex size-10 items-center justify-center rounded-xl text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20">
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <div id="qr-reader-modal" className="w-full max-w-sm" />
          </div>
          {cameraError && (
            <p className="text-red-400 text-sm text-center p-4 shrink-0">{cameraError}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ScanResultDetails({ result }: { result: ScanResult }) {
  return (
    <div className="space-y-2 text-sm">
      {result.guestName && (
        <div className="flex gap-2">
          <span className="text-gray-500 w-28 shrink-0">Cliente</span>
          <span className="font-semibold text-gray-900">{result.guestName}</span>
        </div>
      )}
      {result.numPeople !== undefined && (
        <div className="flex gap-2">
          <span className="text-gray-500 w-28 shrink-0">Persone</span>
          <span className="font-semibold text-gray-900">{result.numPeople}</span>
        </div>
      )}
      {result.eventTitle && (
        <div className="flex gap-2">
          <span className="text-gray-500 w-28 shrink-0">Evento</span>
          <span className="font-medium text-gray-900">{result.eventTitle}</span>
        </div>
      )}
      {result.tableName && (
        <div className="flex gap-2">
          <span className="text-gray-500 w-28 shrink-0">Tavolo</span>
          <span className="font-medium text-gray-900">{result.tableName}</span>
        </div>
      )}
      <div className="flex gap-2">
        <span className="text-gray-500 w-28 shrink-0">Tipo</span>
        <span className="font-medium text-gray-900">
          {result.scanType === 'ticket' ? 'Biglietto' : result.scanType === 'reservation' ? 'Prenotazione tavolo' : 'Sconosciuto'}
        </span>
      </div>
      <div className="flex gap-2">
        <span className="text-gray-500 w-28 shrink-0">Codice</span>
        <span className="font-mono text-gray-700">{result.code}</span>
      </div>
    </div>
  );
}
