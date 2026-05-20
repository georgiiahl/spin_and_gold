import { getDB } from './db';
import { TrainerCard } from '@/domain/types';

export async function getCardsBySpot(spotId: string): Promise<TrainerCard[]> {
  const db = await getDB();
  return db.getAllFromIndex('cards', 'by-spot', spotId);
}

export async function getCard(id: string): Promise<TrainerCard | undefined> {
  const db = await getDB();
  return db.get('cards', id);
}

export async function saveCard(card: TrainerCard): Promise<void> {
  const db = await getDB();
  await db.put('cards', card);
}

export async function saveCards(cards: TrainerCard[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('cards', 'readwrite');
  for (const card of cards) {
    tx.store.put(card);
  }
  await tx.done;
}

export async function getAllCards(): Promise<TrainerCard[]> {
  const db = await getDB();
  return db.getAll('cards');
}
