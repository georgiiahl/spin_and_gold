import { getDB } from './db';
import { SpotRange } from '@/domain/types';

export async function getRange(spotId: string): Promise<SpotRange | undefined> {
  const db = await getDB();
  const record = await db.get('ranges', spotId);
  return record?.range;
}

export async function saveRange(spotId: string, range: SpotRange): Promise<void> {
  const db = await getDB();
  await db.put('ranges', { spotId, range });
}

export async function deleteRange(spotId: string): Promise<void> {
  const db = await getDB();
  await db.delete('ranges', spotId);
}
