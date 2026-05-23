import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Spot, SpotRange, TrainerCard, SessionAnswer } from '@/domain/types';
import type { StoredHandHistory } from '@/storage/hhStore';
import type { StoredChipEvHandResult } from '@/storage/chipEvStore';

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
  handHistories: {
    key: string;
    value: StoredHandHistory;
    indexes: { 'by-imported-at': number };
  };
  chipEvHands: {
    key: string;
    value: StoredChipEvHandResult;
    indexes: { 'by-imported-at': number };
  };
}

const DB_NAME = 'spin-gold-trainer';
const DB_VERSION = 3;

let dbInstance: IDBPDatabase<SpinGoldDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<SpinGoldDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<SpinGoldDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('spots')) {
        const spotStore = db.createObjectStore('spots', { keyPath: 'id' });
        spotStore.createIndex('by-format', 'format');
        spotStore.createIndex('by-stack', 'effectiveStackBb');
      }

      if (!db.objectStoreNames.contains('ranges')) {
        db.createObjectStore('ranges', { keyPath: 'spotId' });
      }

      if (!db.objectStoreNames.contains('cards')) {
        const cardStore = db.createObjectStore('cards', { keyPath: 'id' });
        cardStore.createIndex('by-spot', 'spotId');
        cardStore.createIndex('by-due', 'memory.dueAt');
      }

      if (!db.objectStoreNames.contains('sessions')) {
        const sessionStore = db.createObjectStore('sessions', { keyPath: 'timestamp' });
        sessionStore.createIndex('by-spot', 'spotId');
      }

      if (!db.objectStoreNames.contains('handHistories')) {
        const handHistoryStore = db.createObjectStore('handHistories', { keyPath: 'id' });
        handHistoryStore.createIndex('by-imported-at', 'importedAt');
      }

      if (!db.objectStoreNames.contains('chipEvHands')) {
        const chipEvStore = db.createObjectStore('chipEvHands', { keyPath: 'id' });
        chipEvStore.createIndex('by-imported-at', 'importedAt');
      }
    },
  });

  return dbInstance;
}
