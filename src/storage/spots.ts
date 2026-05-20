import { getDB } from './db';
import { Spot, getSpotCategoryLabel, normalizeSpotCategory } from '@/domain/types';

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

export async function getSpotsByCategory(category: string): Promise<Spot[]> {
  const spots = await getAllSpots();
  const normalizedCategory = normalizeSpotCategory(category) ?? category;
  return spots.filter((spot) => getSpotCategoryLabel(spot.category) === normalizedCategory);
}

export async function getAllCategories(): Promise<string[]> {
  const spots = await getAllSpots();
  const categories = new Set(
    spots
      .map((spot) => normalizeSpotCategory(spot.category))
      .filter((category): category is string => Boolean(category))
  );
  return Array.from(categories).sort((a, b) => a.localeCompare(b));
}
