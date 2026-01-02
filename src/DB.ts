export class DB {
  private dbName: string;
  private storeName: string;
  private db: IDBDatabase | null = null;

  constructor(dbName: string = 'minecraft-world', storeName: string = 'chunks') {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 2);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
        if (!db.objectStoreNames.contains('meta')) {
            db.createObjectStore('meta');
        }
      };
    });
  }

  async set(key: string, value: any, store: string = this.storeName): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('DB not initialized');
      const transaction = this.db.transaction([store], 'readwrite');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.put(value, key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async get(key: string, store: string = this.storeName): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('DB not initialized');
      const transaction = this.db.transaction([store], 'readonly');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
  
  async delete(key: string, store: string = this.storeName): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!this.db) return reject('DB not initialized');
        const transaction = this.db.transaction([store], 'readwrite');
        const objectStore = transaction.objectStore(store);
        const request = objectStore.delete(key);
  
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
  }

  async keys(store: string = this.storeName): Promise<IDBValidKey[]> {
      return new Promise((resolve, reject) => {
          if (!this.db) return reject('DB not initialized');
          const transaction = this.db.transaction([store], 'readonly');
          const objectStore = transaction.objectStore(store);
          const request = objectStore.getAllKeys();

          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
      });
  }

  async clear(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!this.db) return reject('DB not initialized');
        const transaction = this.db.transaction([this.storeName, 'meta'], 'readwrite');
        
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();

        transaction.objectStore(this.storeName).clear();
        transaction.objectStore('meta').clear();
    });
  }
}

export const worldDB = new DB();
