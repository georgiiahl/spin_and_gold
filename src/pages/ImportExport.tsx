import { ChangeEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { isValidHand } from '@/domain/hands';
import { HandFrequencies, SessionAnswer, Spot, SpotRange, TrainerCard } from '@/domain/types';
import { getAllCards } from '@/storage/cards';
import { getDB } from '@/storage/db';
import { getAllRanges, getRange } from '@/storage/ranges';
import { getAllSessions } from '@/storage/sessions';
import { getAllSpots, getSpot } from '@/storage/spots';
import { seedBundledCharts } from '@/storage/seedBundledCharts';

type FullExportPayload = {
  version: 1;
  type: 'full';
  exportedAt: number;
  data: {
    spots: Spot[];
    ranges: Array<{ spotId: string; range: SpotRange }>;
    cards: TrainerCard[];
    sessions: SessionAnswer[];
  };
};

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

export default function ImportExport() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [spotId, setSpotId] = useState('');
  const [status, setStatus] = useState<string>('');
  const [bundledStatus, setBundledStatus] = useState<string>('');
  const [bundledImporting, setBundledImporting] = useState(false);

  useEffect(() => {
    getAllSpots().then((loadedSpots) => {
      const sorted = loadedSpots.sort((a, b) => a.title.localeCompare(b.title));
      setSpots(sorted);
      setSpotId(sorted[0]?.id ?? '');
    });
  }, []);

  async function exportAll() {
    const [allSpots, allRanges, allCards, allSessions] = await Promise.all([
      getAllSpots(),
      getAllRanges(),
      getAllCards(),
      getAllSessions(),
    ]);
    const payload: FullExportPayload = {
      version: 1,
      type: 'full',
      exportedAt: Date.now(),
      data: {
        spots: allSpots,
        ranges: allRanges,
        cards: allCards,
        sessions: allSessions,
      },
    };
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

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Import / Export</h1>

      <div className="space-y-4">
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

      <Link to="/" className="block mt-6 text-sm text-gray-500 hover:text-gray-900">
        ← Dashboard
      </Link>
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

async function replaceAllData(
  spots: Spot[],
  ranges: Array<{ spotId: string; range: SpotRange }>,
  cards: TrainerCard[],
  sessions: SessionAnswer[]
) {
  const db = await getDB();
  const tx = db.transaction(['spots', 'ranges', 'cards', 'sessions'], 'readwrite');
  await Promise.all([
    tx.objectStore('spots').clear(),
    tx.objectStore('ranges').clear(),
    tx.objectStore('cards').clear(),
    tx.objectStore('sessions').clear(),
  ]);
  for (const spot of spots) tx.objectStore('spots').put(spot);
  for (const range of ranges) tx.objectStore('ranges').put(range);
  for (const card of cards) tx.objectStore('cards').put(card);
  for (const session of sessions) tx.objectStore('sessions').put(session);
  await tx.done;
}

async function saveSingleSpot(spot: Spot, range: SpotRange) {
  const db = await getDB();
  const tx = db.transaction(['spots', 'ranges'], 'readwrite');
  tx.objectStore('spots').put(spot);
  tx.objectStore('ranges').put({ spotId: spot.id, range });
  await tx.done;
}
