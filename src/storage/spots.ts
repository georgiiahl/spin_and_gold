import { getDB } from './db';
import { Spot } from '@/domain/types';

export async function getAllSpots(): Promise<Spot[]> {
  const db = await getDB();
  return db.getAll('spots');
}

export async function getSpot(id: string): Promise<Spot | undefined> {
  const db = await getDB();
  return db.get('spots', id);
}

export async function saveSpot(spot: Spot): Promise<void> {
  const db = await getDB();
  await db.put('spots', spot);
}

export async function deleteSpot(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('spots', id);
}
