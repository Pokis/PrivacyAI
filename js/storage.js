/**
 * PrivacyAI Storage Module
 * Wraps IndexedDB for local persistence of projects and settings.
 * Zero external dependencies.
 */

const DB_NAME = 'PrivacyAI_DB';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_SETTINGS = 'settings';

class StorageManager {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("Storage initialization failed", event);
                reject("Storage Error");
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Projects Store: id (key), name, systemPrompt, history, type
                if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
                    db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
                }

                // Settings Store: key (key), value
                if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
                    db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
                }
            };
        });
    }

    // --- Projects ---

    async saveProject(project) {
        return this._params('readwrite', STORE_PROJECTS, store => store.put(project));
    }

    async getProject(id) {
        return this._params('readonly', STORE_PROJECTS, store => store.get(id));
    }

    async getAllProjects() {
        return this._params('readonly', STORE_PROJECTS, store => store.getAll());
    }

    async deleteProject(id) {
        return this._params('readwrite', STORE_PROJECTS, store => store.delete(id));
    }

    // --- Settings ---

    async saveSetting(key, value) {
        return this._params('readwrite', STORE_SETTINGS, store => store.put({ key, value }));
    }

    async getSetting(key) {
        const result = await this._params('readonly', STORE_SETTINGS, store => store.get(key));
        return result ? result.value : null;
    }

    // --- Helper ---

    _params(mode, storeName, callback) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], mode);
            const store = transaction.objectStore(storeName);
            const request = callback(store);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

export const storage = new StorageManager();
