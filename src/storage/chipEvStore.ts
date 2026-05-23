import { buildHandChipEvResult } from '@/domain/chipEv';
import { ParsedHand } from '@/domain/hhParser';
import { getDB } from '@/storage/db';
import { buildStoredHandId } from '@/storage/hhStore';

export type StoredChipEvHandResult = {
  id: string;
  handId: string;
  tournamentId: string;
  format: '3max' | 'hu';
  heroPosition: 'BTN' | 'SB' | 'BB' | '';
  timestamp: string;
  sourceFile: string;
  importedAt: number;
  wasAllInBeforeRiver: boolean;
  netChipsActual: number;
  netChipsAdjusted: number;
  isAllInAdjusted: boolean;
  bbSize: number;
};

export async function saveChipEvHands(sourceFile: string, hands: ParsedHand[]): Promise<void> {
  if (hands.length === 0) return;

  const db = await getDB();
  const tx = db.transaction('chipEvHands', 'readwrite');
  const now = Date.now();

  for (const hand of hands) {
    const result = buildHandChipEvResult(hand);
    const heroPosition = hand.seats.find((seat) => seat.isHero)?.position ?? '';

    await tx.store.put({
      id: buildStoredHandId(hand, sourceFile),
      handId: result.handId,
      tournamentId: result.tournamentId,
      format: hand.format,
      heroPosition,
      timestamp: hand.timestamp,
      sourceFile,
      importedAt: now,
      wasAllInBeforeRiver: hand.isAllInBeforeRiver,
      netChipsActual: result.netChipsActual,
      netChipsAdjusted: result.netChipsAdjusted,
      isAllInAdjusted: result.isAllInAdjusted,
      bbSize: result.bbSize,
    });
  }

  await tx.done;
}

export async function getStoredChipEvHands(): Promise<StoredChipEvHandResult[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex('chipEvHands', 'by-imported-at');
  return rows.sort((left, right) => right.importedAt - left.importedAt);
}

export async function clearStoredChipEvHands(): Promise<void> {
  const db = await getDB();
  await db.clear('chipEvHands');
}
