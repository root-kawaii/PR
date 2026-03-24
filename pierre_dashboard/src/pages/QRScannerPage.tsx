import { useState, useEffect, useRef } from 'react';
import { Search, CheckCircle, XCircle, AlertCircle, UserCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import type { ScanResult } from '../types';

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

  const scannerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html5QrRef = useRef<any>(null);

  const handleScan = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setScanStatus('loading');
    setResult(null);
    setCheckinDone(false);
    try {
      const res = await fetch(`${API_URL}/owner/scan/${encodeURIComponent(trimmed)}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data: ScanResult = await res.json();
      setResult(data);
      if (!data.valid || data.scanType === 'unknown') {
        setScanStatus('invalid');
      } else if (data.alreadyUsed) {
        setScanStatus('used');
      } else {
        setScanStatus('valid');
      }
    } catch {
      setScanStatus('invalid');
      setResult({ valid: false, alreadyUsed: false, scanType: 'unknown', code: trimmed });
    }
  };

  const handleCheckin = async () => {
    if (!result) return;
    setCheckinLoading(true);
    try {
      const res = await fetch(`${API_URL}/owner/checkin/${encodeURIComponent(result.code)}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Errore check-in');
      setCheckinDone(true);
      setScanStatus('used');
    } catch (err) {
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
    try {
      // Dynamically import html5-qrcode to avoid SSR issues
      const { Html5Qrcode } = await import('html5-qrcode');
      if (!scannerRef.current) return;

      const scanner = new Html5Qrcode('qr-reader');
      html5QrRef.current = scanner;
      setCameraActive(true);
      setCameraError(null);

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          scanner.stop().catch(() => {});
          setCameraActive(false);
          handleScan(decodedText);
        },
        undefined,
      );
    } catch (err) {
      setCameraError('Impossibile accedere alla fotocamera. Usa l\'input manuale.');
      setCameraActive(false);
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
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Scanner QR</h1>

      {/* Camera scanner */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Scansione con fotocamera</h2>

        {cameraError && (
          <p className="text-sm text-red-600 mb-3">{cameraError}</p>
        )}

        <div id="qr-reader" ref={scannerRef} className={cameraActive ? 'mb-4 rounded-lg overflow-hidden' : 'hidden'} />

        {!cameraActive ? (
          <button
            onClick={startCamera}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg py-8 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
          >
            <Search size={20} />
            <span>Avvia fotocamera</span>
          </button>
        ) : (
          <button
            onClick={stopCamera}
            className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <X size={16} />
            Ferma fotocamera
          </button>
        )}
      </div>

      {/* Manual input */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Inserimento manuale</h2>
        <form
          onSubmit={(e) => { e.preventDefault(); handleScan(manualCode); }}
          className="flex gap-2"
        >
          <input
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            placeholder="Inserisci codice prenotazione o biglietto"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 font-mono text-sm"
          />
          <button
            type="submit"
            disabled={!manualCode.trim() || scanStatus === 'loading'}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            <Search size={16} />
            Verifica
          </button>
        </form>
      </div>

      {/* Result */}
      {scanStatus !== 'idle' && (
        <div className={`rounded-xl border-2 p-6 ${
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
                <span className="text-xl font-bold text-green-700">VALIDO</span>
              </div>
              <ScanResultDetails result={result} />
              {!checkinDone ? (
                <button
                  onClick={handleCheckin}
                  disabled={checkinLoading}
                  className="mt-4 flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
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
                  {checkinDone ? 'CHECK-IN EFFETTUATO ORA' : 'GIA UTILIZZATO'}
                </span>
              </div>
              <ScanResultDetails result={result} />
            </div>
          )}

          {scanStatus === 'invalid' && (
            <div className="flex items-center gap-2">
              <XCircle size={28} className="text-red-600" />
              <span className="text-xl font-bold text-red-700">NON VALIDO</span>
            </div>
          )}

          <button
            onClick={handleReset}
            className="mt-4 text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Nuova scansione
          </button>
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
