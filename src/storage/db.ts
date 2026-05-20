import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Spot, SpotRange, TrainerCard, SessionAnswer } from '@/domain/types';

interface SpinGoldDB extends DBSchema {
  spots: {
    key: string;
    value: Spot;
    indexes: { 'by-format': string; 'by-stack': number };
  };
  ranges: {
    key: string; // spotId
    value: { spotId: string; range: SpotRange };
  };
  cards: {
    key: string;
    value: TrainerCard;
    indexes: { 'by-spot': string; 'by-due': number };
  };
  sessions: {
    key: number; // timestamp
    value: SessionAnswer;
    indexes: { 'by-spot': string };
  };
}

const DB_NAME = 'spin-gold-trainer';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<SpinGoldDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<SpinGoldDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<SpinGoldDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Spots
      const spotStore = db.createObjectStore('spots', { keyPath: 'id' });
      spotStore.createIndex('by-format', 'format');
      spotStore.createIndex('by-stack', 'effectiveStackBb');

      // Ranges
      db.createObjectStore('ranges', { keyPath: 'spotId' });

      // Trainer cards
      const cardStore = db.createObjectStore('cards', { keyPath: 'id' });
      cardStore.createIndex('by-spot', 'spotId');
      cardStore.createIndex('by-due', 'memory.dueAt');

      // Session history
      const sessionStore = db.createObjectStore('sessions', { keyPath: 'timestamp' });
      sessionStore.createIndex('by-spot', 'spotId');
    },
  });

  return dbInstance;
}
