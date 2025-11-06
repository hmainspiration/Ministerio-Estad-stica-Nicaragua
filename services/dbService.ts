
import type { CensusRecord, SyncOperation } from '../types';

const DB_NAME = 'CensoDB';
const DB_VERSION = 1;
const RECORDS_STORE = 'censusRecords';
const SYNC_STORE = 'syncQueue';

let db: IDBDatabase;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(RECORDS_STORE)) {
        dbInstance.createObjectStore(RECORDS_STORE, { keyPath: 'id' });
      }
      if (!dbInstance.objectStoreNames.contains(SYNC_STORE)) {
        dbInstance.createObjectStore(SYNC_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

function getStore(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDB().then(db => {
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  });
}

export const dbService = {
  // Census Records methods
  async getAllRecords(): Promise<CensusRecord[]> {
    const store = await getStore(RECORDS_STORE, 'readonly');
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async clearAndBulkInsertRecords(records: CensusRecord[]): Promise<void> {
    const store = await getStore(RECORDS_STORE, 'readwrite');
    const clearRequest = store.clear();
    return new Promise((resolve, reject) => {
      clearRequest.onsuccess = () => {
        records.forEach(record => store.put(record));
        // This assumes the transaction completes successfully
        store.transaction.oncomplete = () => resolve();
        store.transaction.onerror = (e) => reject((e.target as IDBRequest).error);
      };
      clearRequest.onerror = () => reject(clearRequest.error);
    });
  },
  
  // Sync Queue methods
  async addSyncOperation(operation: Omit<SyncOperation, 'id'>): Promise<void> {
    const store = await getStore(SYNC_STORE, 'readwrite');
    store.add(operation);
  },

  async getSyncQueue(): Promise<SyncOperation[]> {
    const store = await getStore(SYNC_STORE, 'readonly');
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async removeSyncOperation(id: number): Promise<void> {
    const store = await getStore(SYNC_STORE, 'readwrite');
    store.delete(id);
  },
};
