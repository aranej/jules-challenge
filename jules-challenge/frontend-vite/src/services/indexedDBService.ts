// Helper functions for IndexedDB operations

interface DataPoint {
  timestamp: number;
  value: number;
  category: string;
}

const DB_NAME = 'DashboardDB';
const STORE_NAME = 'datapointer-store';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { autoIncrement: true });
        // Could add indexes here if needed, e.g., on 'timestamp'
        // store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      console.log('IndexedDB upgrade needed, store created/updated.');
    };

    request.onsuccess = (event) => {
      console.log('IndexedDB opened successfully.');
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
      dbPromise = null; // Reset promise on error
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
  return dbPromise;
};

export const addDataPoints = async (dataPoints: DataPoint | DataPoint[]): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const pointsArray = Array.isArray(dataPoints) ? dataPoints : [dataPoints];

    pointsArray.forEach(point => {
      store.add(point); // autoIncrement key handles uniqueness
    });

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        // console.log('Data points added to IndexedDB successfully.');
        resolve();
      };
      transaction.onerror = (event) => {
        console.error('Error adding data points to IndexedDB:', (event.target as IDBTransaction).error);
        reject((event.target as IDBTransaction).error);
      };
    });
  } catch (error) {
    console.error('Failed to open DB for adding data points:', error);
    return Promise.reject(error);
  }
};

export const getAllDataPoints = async (): Promise<DataPoint[]> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        // console.log('Data points retrieved from IndexedDB.');
        resolve((event.target as IDBRequest<DataPoint[]>).result);
      };
      request.onerror = (event) => {
        console.error('Error retrieving data points from IndexedDB:', (event.target as IDBRequest).error);
        reject((event.target as IDBRequest).error);
      };
    });
  } catch (error) {
    console.error('Failed to open DB for retrieving data points:', error);
    return Promise.resolve([]); // Return empty array on error to not break app
  }
};

// TODO: Implement data eviction strategy (e.g., limit by number of points or time window)
// export const trimDataStore = async (maxEntries: number) => { ... }
// This could be called periodically or after adding new data.
// For example, get all keys, sort them, and delete oldest ones if count > maxEntries.
// Or, use a cursor to delete entries older than a certain timestamp.
// Example:
// const store = transaction.objectStore(STORE_NAME);
// const cursorReq = store.openCursor(null, 'prev'); // Start from newest
// let count = 0;
// cursorReq.onsuccess = (e) => {
//   const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
//   if (cursor) {
//     count++;
//     if (count > maxEntries) {
//       cursor.delete();
//     }
//     cursor.continue();
//   }
// };
// This is a complex operation and needs careful implementation.
// For now, we'll store all data.
