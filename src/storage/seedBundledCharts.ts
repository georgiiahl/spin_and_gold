import { Spot, SpotRange, TrainerCard, SessionAnswer } from '@/domain/types';
import { saveSpot } from './spots';
import { saveRange } from './ranges';

const STORAGE_KEY = 'spin-gold-seeded-charts';

type SpotPayload = {
  version: 1;
  type: 'spot';
  exportedAt: number;
  data: {
    spot: Spot;
    range: SpotRange;
  };
};

type FullPayload = {
  version: 1;
  type: 'full';
  exportedAt: number;
  data: {
    spots: Spot[];
    ranges: Array<{ spotId: string; range: SpotRange }>;
    cards?: TrainerCard[];
    sessions?: SessionAnswer[];
  };
};

type ChartPayload = SpotPayload | FullPayload;

function getSeededFiles(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function markFileSeeded(filename: string): void {
  const seeded = getSeededFiles();
  if (!seeded.includes(filename)) {
    seeded.push(filename);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  }
}

async function importPayload(payload: ChartPayload): Promise<number> {
  let count = 0;
  if (payload.type === 'spot') {
    await saveSpot(payload.data.spot);
    await saveRange(payload.data.spot.id, payload.data.range);
    count = 1;
  } else if (payload.type === 'full') {
    for (const spot of payload.data.spots) {
      await saveSpot(spot);
      count++;
    }
    for (const entry of payload.data.ranges) {
      await saveRange(entry.spotId, entry.range);
    }
  }
  return count;
}

export type SeedResult = {
  importedSpots: number;
  importedFiles: string[];
};

export async function seedBundledCharts(force = false): Promise<SeedResult> {
  const base = import.meta.env.BASE_URL;
  const manifestUrl = `${base}charts/manifest.json`;

  const manifestRes = await fetch(manifestUrl);
  if (!manifestRes.ok) {
    throw new Error(`Failed to fetch manifest: ${manifestRes.status}`);
  }
  const manifest = (await manifestRes.json()) as string[];

  if (!Array.isArray(manifest) || manifest.length === 0) {
    return { importedSpots: 0, importedFiles: [] };
  }

  const seeded = getSeededFiles();
  const toImport = force ? manifest : manifest.filter((f) => !seeded.includes(f));

  let importedSpots = 0;
  const importedFiles: string[] = [];

  for (const filename of toImport) {
    const url = `${base}charts/${filename}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[seedBundledCharts] Failed to fetch ${filename}: ${res.status}`);
        continue;
      }
      const payload = (await res.json()) as ChartPayload;
      if (!payload || payload.version !== 1 || !payload.type || !payload.data) {
        console.warn(`[seedBundledCharts] Unsupported format in ${filename}`);
        continue;
      }
      const count = await importPayload(payload);
      importedSpots += count;
      importedFiles.push(filename);
      markFileSeeded(filename);
    } catch (err) {
      console.warn(`[seedBundledCharts] Error importing ${filename}:`, err);
    }
  }

  return { importedSpots, importedFiles };
}
