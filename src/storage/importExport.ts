import { SessionAnswer, Spot, SpotRange, TrainerCard } from '@/domain/types';
import { getAllCards } from '@/storage/cards';
import { getDB } from '@/storage/db';
import { getAllRanges } from '@/storage/ranges';
import { getAllSessions } from '@/storage/sessions';
import { loadSettings, AppSettings } from '@/storage/settings';
import { getAllSpots } from '@/storage/spots';

export type FullExportPayload = {
  version: 1;
  type: 'full';
  exportedAt: number;
  data: {
    spots: Spot[];
    ranges: Array<{ spotId: string; range: SpotRange }>;
    cards: TrainerCard[];
    sessions: SessionAnswer[];
    settings?: AppSettings;
  };
};

export async function createFullExportPayload(): Promise<FullExportPayload> {
  const [spots, ranges, cards, sessions] = await Promise.all([
    getAllSpots(),
    getAllRanges(),
    getAllCards(),
    getAllSessions(),
  ]);
  return {
    version: 1,
    type: 'full',
    exportedAt: Date.now(),
    data: {
      spots,
      ranges,
      cards,
      sessions,
      settings: loadSettings(),
    },
  };
}

export async function replaceAllData(
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
