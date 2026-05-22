import { ParsedHand } from '@/domain/hhParser';
import { getDB } from '@/storage/db';

export type StoredHandHistory = {
  id: string;
  hand: ParsedHand;
  sourceFile: string;
  importedAt: number;
};

export function buildStoredHandId(hand: ParsedHand, sourceFile: string): string {
  const tournamentPart = hand.tournamentId || sourceFile;
  const timestampPart = hand.timestamp || 'no-ts';
  const heroCardsPart = hand.heroCards?.join('-') || 'no-cards';
  const heroActionPart = hand.heroAction?.action || 'no-action';
  return `${tournamentPart}:${hand.handId}:${timestampPart}:${heroCardsPart}:${heroActionPart}`;
}

export async function saveImportedHands(sourceFile: string, hands: ParsedHand[]): Promise<void> {
  if (hands.length === 0) return;
  const db = await getDB();
  const tx = db.transaction('handHistories', 'readwrite');
  const now = Date.now();

  for (const hand of hands) {
    await tx.store.put({
      id: buildStoredHandId(hand, sourceFile),
      hand,
      sourceFile,
      importedAt: now,
    });
  }

  await tx.done;
}

export async function getStoredHands(): Promise<StoredHandHistory[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex('handHistories', 'by-imported-at');
  return rows.sort((a, b) => b.importedAt - a.importedAt);
}

export async function clearStoredHands(): Promise<void> {
  const db = await getDB();
  await db.clear('handHistories');
}
