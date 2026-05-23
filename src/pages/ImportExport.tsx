import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { isValidHand } from '@/domain/hands';
import { HandFrequencies, Spot, SpotRange } from '@/domain/types';
import { getDB } from '@/storage/db';
import { createFullExportPayload, FullExportPayload, replaceAllData } from '@/storage/importExport';
import { getRange } from '@/storage/ranges';
import { getAllSpots, getSpot } from '@/storage/spots';
import { seedBundledCharts } from '@/storage/seedBundledCharts';
import { SETTINGS_KEY } from '@/storage/settings';
import { encodeSyncPayload } from '@/storage/sync';

type SpotExportPayload = {
  version: 1;
  type: 'spot';
  exportedAt: number;
  data: {
    spot: Spot;
    range: SpotRange;
  };
};
const FREQUENCY_SUM_TOLERANCE = 0.01;
const MAX_SYNC_QR_URL_LENGTH = 2500;

export default function ImportExport() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [spotId, setSpotId] = useState('');
  const [status, setStatus] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [syncWarning, setSyncWarning] = useState<string>('');
  const [syncUrl, setSyncUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef<number | null>(null);
  const [bundledStatus, setBundledStatus] = useState<string>('');
  const [bundledImporting, setBundledImporting] = useState(false);

  useEffect(() => {
    getAllSpots().then((loadedSpots) => {
      const sorted = loadedSpots.sort((a, b) => a.title.localeCompare(b.title));
      setSpots(sorted);
      setSpotId(sorted[0]?.id ?? '');
    });
  }, []);

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current !== null) {
        window.clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

  async function exportAll() {
    const payload = await createFullExportPayload();
    downloadJson(`spin-gold-full-${Date.now()}.json`, payload);
  }

  async function exportSpot() {
    if (!spotId) return;
    const [spot, range] = await Promise.all([getSpot(spotId), getRange(spotId)]);
    if (!spot || !range) {
      alert('Spot or range not found.');
      return;
    }
    const payload: SpotExportPayload = {
      version: 1,
      type: 'spot',
      exportedAt: Date.now(),
      data: {
        spot,
        range,
      },
    };
    downloadJson(`spin-gold-spot-${spot.id}.json`, payload);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as FullExportPayload | SpotExportPayload;
      if (!parsed || parsed.version !== 1 || !parsed.type || !parsed.data) {
        throw new Error('Unsupported file format.');
      }

      if (parsed.type === 'full') {
        parsed.data.ranges.forEach((entry) => validateRange(entry.range));
        const confirmed = confirm('Import full backup and replace current local data?');
        if (!confirmed) return;
        await replaceAllData(parsed.data.spots, parsed.data.ranges, parsed.data.cards, parsed.data.sessions);
        if (parsed.data.settings) {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed.data.settings));
        }
        setStatus(`Imported full backup: ${parsed.data.spots.length} spots.`);
      } else {
        validateRange(parsed.data.range);
        await saveSingleSpot(parsed.data.spot, parsed.data.range);
        setStatus(`Imported spot "${parsed.data.spot.title}".`);
      }
      const refreshed = await getAllSpots();
      setSpots(refreshed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed.';
      alert(message);
      setStatus(`Import failed: ${message}`);
    } finally {
      event.target.value = '';
    }
  }

  async function handleImportBundled() {
    setBundledImporting(true);
    setBundledStatus('');
    try {
      const result = await seedBundledCharts(true);
      if (result.importedFiles.length === 0) {
        setBundledStatus('No chart files in manifest.');
      } else {
        setBundledStatus(`Imported ${result.importedSpots} spot(s) from ${result.importedFiles.length} file(s).`);
        const refreshed = await getAllSpots();
        setSpots(refreshed.sort((a, b) => a.title.localeCompare(b.title)));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed.';
      setBundledStatus(`Error: ${message}`);
    } finally {
      setBundledImporting(false);
    }
  }

  async function buildSyncUrl(origin: string) {
    const payload = await createFullExportPayload();
    return encodeSyncPayload(payload, origin);
  }

  async function handleShowQrCode() {
    setSyncStatus('');
    setCopied(false);
    try {
      const url = await buildSyncUrl(window.location.origin);
      if (url.length > MAX_SYNC_QR_URL_LENGTH) {
        setSyncUrl('');
        setSyncWarning('Sync link is too large for reliable QR scanning. Use full file export/import instead.');
        return;
      }
      setSyncWarning('');
      setSyncUrl(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to prepare sync data.';
      setSyncStatus(message);
    }
  }

  async function handleCopySyncLink() {
    setSyncStatus('');
    try {
      const url = await buildSyncUrl(window.location.origin);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setSyncUrl(url);
      setSyncWarning(url.length > MAX_SYNC_QR_URL_LENGTH
        ? 'Link copied, but this payload may be too large for QR. Open the copied link directly on the target device.'
        : ''
      );
      if (copiedTimeoutRef.current !== null) {
        window.clearTimeout(copiedTimeoutRef.current);
      }
      copiedTimeoutRef.current = window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to copy sync link.';
      setSyncStatus(message);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="text-xl font-bold mb-4">Import / Export</h1>

      <div className="space-y-4">
        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Sync between devices</h2>
          <p className="text-sm text-gray-500">Computer → Phone: show QR. Phone → Computer: copy link and open it on your computer.</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleShowQrCode}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              Show QR code
            </button>
            <button
              onClick={handleCopySyncLink}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {copied ? 'Copied!' : 'Copy sync link'}
            </button>
          </div>
          {syncWarning && <p className="text-sm text-amber-700">{syncWarning}</p>}
          {syncStatus && <p className="text-sm text-gray-700">{syncStatus}</p>}
          {syncUrl && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-600 mb-3">Scan this QR with your phone.</p>
              <div className="inline-block rounded-lg bg-white p-3">
                <QRCodeSVG value={syncUrl} size={256} />
              </div>
            </div>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Export full backup</h2>
          <p className="text-sm text-gray-500">Download all spots, ranges, cards and sessions.</p>
          <button onClick={exportAll} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
            Export all data
          </button>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Export single spot</h2>
          <p className="text-sm text-gray-500">Export one spot with its range.</p>
          <div className="flex gap-2">
            <select
              value={spotId}
              onChange={(e) => setSpotId(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-sm"
            >
              {spots.length === 0 && <option value="">No spots</option>}
              {spots.map((spot) => (
                <option key={spot.id} value={spot.id}>
                  {spot.title}
                </option>
              ))}
            </select>
            <button
              onClick={exportSpot}
              disabled={!spotId}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
            >
              Export spot
            </button>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Bundled charts</h2>
          <p className="text-sm text-gray-500">
            Import chart files bundled with the app (from public/charts/).
          </p>
          <button
            onClick={handleImportBundled}
            disabled={bundledImporting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
          >
            {bundledImporting ? 'Importing…' : 'Import bundled charts'}
          </button>
          {bundledStatus && <p className="text-sm text-gray-700">{bundledStatus}</p>}
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Import JSON</h2>
          <p className="text-sm text-gray-500">
            Supports full backup JSON (replace all data) and single spot JSON.
          </p>
          <input
            type="file"
            accept="application/json,.json"
            onChange={handleImport}
            className="block text-sm text-gray-700 file:mr-2 file:px-3 file:py-2 file:rounded file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-500"
          />
        </section>
      </div>

      {status && <div className="mt-4 text-sm text-gray-700">{status}</div>}

    </div>
  );
}

function validateRange(range: SpotRange) {
  for (const [hand, freq] of Object.entries(range)) {
    if (!isValidHand(hand)) {
      throw new Error(`Invalid hand key found: ${hand}`);
    }
    validateFrequency(freq, hand);
  }
}

function validateFrequency(freq: HandFrequencies, hand: string) {
  const values = [freq.fold, freq.call, freq.raise, freq.jam];
  if (values.some((value) => typeof value !== 'number' || value < 0 || value > 1)) {
    throw new Error(`Invalid frequencies for ${hand}.`);
  }
  const sum = values.reduce((acc, value) => acc + value, 0);
  if (Math.abs(sum - 1) > FREQUENCY_SUM_TOLERANCE) {
    throw new Error(`Frequencies for ${hand} must sum to 1.`);
  }
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function saveSingleSpot(spot: Spot, range: SpotRange) {
  const db = await getDB();
  const tx = db.transaction(['spots', 'ranges'], 'readwrite');
  tx.objectStore('spots').put(spot);
  tx.objectStore('ranges').put({ spotId: spot.id, range });
  await tx.done;
}
