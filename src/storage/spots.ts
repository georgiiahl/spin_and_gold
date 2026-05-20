import { getDB } from './db';
import { Spot } from '@/domain/types';
import { getSpotCategoryLabel } from '@/domain/spotCategories';

export async function getAllSpots(): Promise<Spot[]> {
  const db = await getDB();
  return db.getAll('spots');
}

export async function getSpotsByCategory(category: string): Promise<Spot[]> {
  const spots = await getAllSpots();
  return spots.filter((spot) => getSpotCategoryLabel(spot.category) === category);
}

export async function getAllCategories(): Promise<string[]> {
  const spots = await getAllSpots();
  return Array.from(new Set(spots.map((spot) => getSpotCategoryLabel(spot.category)))).sort();
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
