import { getDB } from './db';
import { SessionAnswer } from '@/domain/types';

export async function saveSession(answer: SessionAnswer): Promise<void> {
  const db = await getDB();
  await db.put('sessions', answer);
}

export async function getSessionsBySpot(spotId: string): Promise<SessionAnswer[]> {
  const db = await getDB();
  return db.getAllFromIndex('sessions', 'by-spot', spotId);
}

export async function getAllSessions(): Promise<SessionAnswer[]> {
  const db = await getDB();
  return db.getAll('sessions');
}
