import { useState, useEffect } from 'react';
import { POMODORO_CONFIG } from '../config/constants';

export const useIndexedDB = () => {
    const [db, setDb] = useState(null);
    const [sessions, setSessions] = useState(0);
    const [subjects, setSubjects] = useState([]);

    const normalizeIDBError = (e) => {
        try {
            if (!e) return new Error('Unknown IndexedDB error');
            if (e instanceof Error) return e;
            // event from IDB often has target.error
            if (e.target && e.target.error) return e.target.error;
            // sometimes a DOMException or object with message
            if (e.message) return new Error(e.message);
            return new Error(String(e));
        } catch (ex) {
            return new Error('IndexedDB error');
        }
    };

    useEffect(() => {
        const initDB = () => {
            const request = indexedDB.open(
                POMODORO_CONFIG.DB_NAME, 
                POMODORO_CONFIG.DB_VERSION
            );

            request.onerror = (event) => {
                console.error("Database error:", event.target.error);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(POMODORO_CONFIG.STORE_NAME)) {
                    db.createObjectStore(POMODORO_CONFIG.STORE_NAME, { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                }
                // create events store for calendar events
                if (!db.objectStoreNames.contains('events')) {
                    const store = db.createObjectStore('events', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    // index by date for efficient queries (date stored as YYYY-MM-DD)
                    store.createIndex('by_date', 'date', { unique: false });
                }
                // create subjects store
                if (!db.objectStoreNames.contains('subjects')) {
                    const s = db.createObjectStore('subjects', { keyPath: 'id', autoIncrement: true });
                    s.createIndex('by_name', 'name', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                let db = event.target.result;
                // If the 'events' store was not created (older DB), upgrade DB version to add it
                if (!db.objectStoreNames.contains('events')) {
                    const newVersion = db.version + 1;
                    db.close();
                    const upgradeReq = indexedDB.open(POMODORO_CONFIG.DB_NAME, newVersion);
                    upgradeReq.onupgradeneeded = (e) => {
                        const upgradeDb = e.target.result;
                        if (!upgradeDb.objectStoreNames.contains('events')) {
                            const store = upgradeDb.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
                            store.createIndex('by_date', 'date', { unique: false });
                        }
                        if (!upgradeDb.objectStoreNames.contains('subjects')) {
                            const s = upgradeDb.createObjectStore('subjects', { keyPath: 'id', autoIncrement: true });
                            s.createIndex('by_name', 'name', { unique: false });
                        }
                    };
                    upgradeReq.onsuccess = (e2) => {
                        db = e2.target.result;
                        setDb(db);
                        loadSessions(db);
                        loadSubjects(db);
                    };
                    upgradeReq.onerror = (err) => {
                        console.error('Failed to upgrade DB for events store', err);
                    };
                } else {
                    setDb(db);
                    loadSessions(db);
                    loadSubjects(db);
                }
            };
        };

        initDB();
    }, []);

    const loadSessions = (database) => {
        const transaction = database.transaction([POMODORO_CONFIG.STORE_NAME], 'readonly');
        const store = transaction.objectStore(POMODORO_CONFIG.STORE_NAME);
        const countRequest = store.count();
        
        countRequest.onsuccess = () => {
            setSessions(countRequest.result);
        };
    };

    const loadSubjects = (database) => {
        if (!database) return;
        try {
            const tx = database.transaction(['subjects'], 'readonly');
            const store = tx.objectStore('subjects');
            const req = store.getAll();
            req.onsuccess = () => {
                try { setSubjects(req.result || []); } catch (e) { /* ignore */ }
            };
            req.onerror = (e) => { console.error('loadSubjects error', e); };
        } catch (e) {
            // store may not exist yet
        }
    };

    // EVENTS API
    const getEventsForMonth = (year, month) => {
        // month is 0-based (0 = Jan)
        return new Promise((resolve, reject) => {
            if (!db) return resolve([]);
            const transaction = db.transaction(['events'], 'readonly');
            const store = transaction.objectStore('events');
            const index = store.index('by_date');
            const events = [];

            const monthStr = String(month + 1).padStart(2, '0');
            const start = `${year}-${monthStr}-01`;
            // compute end date as next month day 01
            const next = new Date(year, month + 1, 1);
            const nextMonthStr = String(next.getMonth() + 1).padStart(2, '0');
            const end = `${next.getFullYear()}-${nextMonthStr}-01`;

            // range query from start (inclusive) to end (exclusive)
            const range = IDBKeyRange.bound(start, end, false, true);
            index.openCursor(range).onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    events.push(cursor.value);
                    cursor.continue();
                }
            };

            transaction.oncomplete = () => resolve(events);
            transaction.onerror = (err) => reject(normalizeIDBError(err));
        });
    };

    const saveEvent = (event) => {
        // event: { date: 'YYYY-MM-DD', title: '...', color: '#hex' }
        // If DB not initialized yet, wait briefly for it to become available.
        const waitForDb = () => new Promise((resolve, reject) => {
            const start = Date.now();
            const interval = setInterval(() => {
                if (db) {
                    clearInterval(interval);
                    resolve(db);
                } else if (Date.now() - start > 10000) { // wait up to 10s now
                    clearInterval(interval);
                    reject(new Error('DB not initialized'));
                }
            }, 50);
        });

        // Ensure the events store exists before trying to write.
        const ensureEventsStore = (database) => {
            return new Promise((resolve, reject) => {
                try {
                    if (database.objectStoreNames.contains('events')) return resolve(database);
                } catch (e) {
                    // Some browsers may throw if database is in a weird state; continue to upgrade path
                }

                const newVersion = database.version + 1;
                database.close();
                const upgradeReq = indexedDB.open(POMODORO_CONFIG.DB_NAME, newVersion);
                upgradeReq.onupgradeneeded = (e) => {
                    const upgradeDb = e.target.result;
                    if (!upgradeDb.objectStoreNames.contains('events')) {
                        const store = upgradeDb.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
                        store.createIndex('by_date', 'date', { unique: false });
                    }
                };
                upgradeReq.onsuccess = (e2) => {
                    resolve(e2.target.result);
                };
                upgradeReq.onerror = (err) => reject(err);
            });
        };

        let triedReopen = false;
        const addOnce = (database) => {
            return new Promise((resolve, reject) => {
                try {
                    const transaction = database.transaction(['events'], 'readwrite');
                    const store = transaction.objectStore('events');
                        const req = (event.id ? store.put(event) : store.add(event));
                        req.onsuccess = (ev) => resolve({ ...event, id: ev.target.result || event.id });
                        req.onerror = (e) => reject(normalizeIDBError(e));
                    // also listen for transaction-level errors
                    transaction.onabort = transaction.onerror = (te) => {
                        reject(normalizeIDBError(te));
                    };
                } catch (ex) {
                    reject(ex);
                }
            });
        };

        const tryWithRetry = (database) => {
            return addOnce(database).catch(err => {
                console.warn('saveEvent add failed, will attempt reopen once:', err);
                if (triedReopen) return Promise.reject(err);
                triedReopen = true;
                // attempt to reopen the DB connection and retry
                return new Promise((resolve, reject) => {
                    const reopenReq = indexedDB.open(POMODORO_CONFIG.DB_NAME);
                    reopenReq.onsuccess = (e) => {
                        const freshDb = e.target.result;
                        try { setDb(freshDb); } catch (e) { /* ignore */ }
                        // ensure events store exists on freshDb then retry
                        ensureEventsStore(freshDb).then(dbWithStore => {
                            addOnce(dbWithStore).then(resolve).catch(reject);
                        }).catch(reject);
                    };
                    reopenReq.onerror = (re) => reject(normalizeIDBError(re));
                });
            });
        };

        const openFreshDbIfNeeded = () => {
            if (db) return Promise.resolve(db);
            return new Promise((resolve, reject) => {
                // open a fresh connection and create stores if needed
                // Open without a version to avoid requesting a lower version than the existing DB
                const req = indexedDB.open(POMODORO_CONFIG.DB_NAME);
                req.onupgradeneeded = (e) => {
                    const idb = e.target.result;
                    if (!idb.objectStoreNames.contains(POMODORO_CONFIG.STORE_NAME)) {
                        idb.createObjectStore(POMODORO_CONFIG.STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    }
                    if (!idb.objectStoreNames.contains('events')) {
                        const store = idb.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
                        store.createIndex('by_date', 'date', { unique: false });
                    }
                };
                req.onsuccess = (e) => {
                    try { setDb(e.target.result); } catch (_) { /* ignore */ }
                    resolve(e.target.result);
                };
                req.onerror = (e) => reject(normalizeIDBError(e));
            });
        };

        return openFreshDbIfNeeded()
            .then(database => ensureEventsStore(database))
            .then(databaseWithStore => tryWithRetry(databaseWithStore));
    };

    // SUBJECTS API
    const ensureSubjectsStore = (database) => {
        return new Promise((resolve, reject) => {
            try {
                if (database.objectStoreNames.contains('subjects')) return resolve(database);
            } catch (e) {
                // fall through to upgrade path
            }

            const newVersion = database.version + 1;
            database.close();
            const upgradeReq = indexedDB.open(POMODORO_CONFIG.DB_NAME, newVersion);
            upgradeReq.onupgradeneeded = (e) => {
                const upgradeDb = e.target.result;
                if (!upgradeDb.objectStoreNames.contains('subjects')) {
                    const s = upgradeDb.createObjectStore('subjects', { keyPath: 'id', autoIncrement: true });
                    s.createIndex('by_name', 'name', { unique: false });
                }
                if (!upgradeDb.objectStoreNames.contains(POMODORO_CONFIG.STORE_NAME)) {
                    upgradeDb.createObjectStore(POMODORO_CONFIG.STORE_NAME, { keyPath: 'id', autoIncrement: true });
                }
                if (!upgradeDb.objectStoreNames.contains('events')) {
                    const store = upgradeDb.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('by_date', 'date', { unique: false });
                }
            };
            upgradeReq.onsuccess = (e2) => resolve(e2.target.result);
            upgradeReq.onerror = (err) => reject(normalizeIDBError(err));
        });
    };

    const saveSubject = (subject) => {
        // subject: { name: '...', color: '#hex' } - if has id, will be put
        const openFreshDbIfNeeded = () => {
            if (db) return Promise.resolve(db);
            return new Promise((resolve, reject) => {
                const req = indexedDB.open(POMODORO_CONFIG.DB_NAME);
                req.onupgradeneeded = (e) => {
                    const idb = e.target.result;
                    if (!idb.objectStoreNames.contains(POMODORO_CONFIG.STORE_NAME)) {
                        idb.createObjectStore(POMODORO_CONFIG.STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    }
                    if (!idb.objectStoreNames.contains('events')) {
                        const store = idb.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
                        store.createIndex('by_date', 'date', { unique: false });
                    }
                    if (!idb.objectStoreNames.contains('subjects')) {
                        const s = idb.createObjectStore('subjects', { keyPath: 'id', autoIncrement: true });
                        s.createIndex('by_name', 'name', { unique: false });
                    }
                };
                req.onsuccess = (e) => { try { setDb(e.target.result); } catch (_) {} ; resolve(e.target.result); };
                req.onerror = (e) => reject(normalizeIDBError(e));
            });
        };

        let triedReopen = false;
        const addOnce = (database) => {
            return new Promise((resolve, reject) => {
                try {
                    const tx = database.transaction(['subjects'], 'readwrite');
                    const store = tx.objectStore('subjects');
                    const req = (subject.id ? store.put(subject) : store.add(subject));
                    req.onsuccess = (e) => {
                        loadSubjects(database);
                        resolve({ ...subject, id: e.target.result });
                    };
                    req.onerror = (e) => reject(normalizeIDBError(e));
                    tx.onabort = tx.onerror = (te) => reject(normalizeIDBError(te));
                } catch (ex) {
                    reject(normalizeIDBError(ex));
                }
            });
        };

        const tryWithRetry = (database) => {
            return addOnce(database).catch(err => {
                console.warn('saveSubject add failed, will attempt reopen once:', err);
                if (triedReopen) return Promise.reject(err);
                triedReopen = true;
                return new Promise((resolve, reject) => {
                    const reopenReq = indexedDB.open(POMODORO_CONFIG.DB_NAME);
                    reopenReq.onsuccess = (e) => {
                        const freshDb = e.target.result;
                        try { setDb(freshDb); } catch (e) { /* ignore */ }
                        ensureSubjectsStore(freshDb).then(dbWithStore => {
                            addOnce(dbWithStore).then(resolve).catch(reject);
                        }).catch(reject);
                    };
                    reopenReq.onerror = (re) => reject(normalizeIDBError(re));
                });
            });
        };

        return openFreshDbIfNeeded().then(database => ensureSubjectsStore(database)).then(databaseWithStore => tryWithRetry(databaseWithStore));
    };

    const deleteSubject = (id) => {
        const openFreshDbIfNeeded = () => {
            if (db) return Promise.resolve(db);
            return new Promise((resolve, reject) => {
                const req = indexedDB.open(POMODORO_CONFIG.DB_NAME);
                req.onupgradeneeded = (e) => {
                    const idb = e.target.result;
                    if (!idb.objectStoreNames.contains(POMODORO_CONFIG.STORE_NAME)) {
                        idb.createObjectStore(POMODORO_CONFIG.STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    }
                    if (!idb.objectStoreNames.contains('events')) {
                        const store = idb.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
                        store.createIndex('by_date', 'date', { unique: false });
                    }
                    if (!idb.objectStoreNames.contains('subjects')) {
                        const s = idb.createObjectStore('subjects', { keyPath: 'id', autoIncrement: true });
                        s.createIndex('by_name', 'name', { unique: false });
                    }
                };
                req.onsuccess = (e) => { try { setDb(e.target.result); } catch (_) {} ; resolve(e.target.result); };
                req.onerror = (e) => reject(normalizeIDBError(e));
            });
        };

        return openFreshDbIfNeeded().then(database => {
            return new Promise((resolve, reject) => {
                try {
                    const tx = database.transaction(['subjects'], 'readwrite');
                    const store = tx.objectStore('subjects');
                    const req = store.delete(id);
                    req.onsuccess = () => { loadSubjects(database); resolve(); };
                    req.onerror = (e) => reject(normalizeIDBError(e));
                    tx.onabort = tx.onerror = (te) => reject(normalizeIDBError(te));
                } catch (ex) {
                    reject(normalizeIDBError(ex));
                }
            });
        });
    };

    const deleteEvent = (id) => {
        const openFreshDbIfNeeded = () => {
            if (db) return Promise.resolve(db);
            return new Promise((resolve, reject) => {
                const req = indexedDB.open(POMODORO_CONFIG.DB_NAME);
                req.onupgradeneeded = (e) => {
                    const idb = e.target.result;
                    if (!idb.objectStoreNames.contains(POMODORO_CONFIG.STORE_NAME)) {
                        idb.createObjectStore(POMODORO_CONFIG.STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    }
                    if (!idb.objectStoreNames.contains('events')) {
                        const store = idb.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
                        store.createIndex('by_date', 'date', { unique: false });
                    }
                    if (!idb.objectStoreNames.contains('subjects')) {
                        const s = idb.createObjectStore('subjects', { keyPath: 'id', autoIncrement: true });
                        s.createIndex('by_name', 'name', { unique: false });
                    }
                };
                req.onsuccess = (e) => { try { setDb(e.target.result); } catch (_) {} ; resolve(e.target.result); };
                req.onerror = (e) => reject(normalizeIDBError(e));
            });
        };

        return openFreshDbIfNeeded().then(database => {
            return new Promise((resolve, reject) => {
                try {
                    const tx = database.transaction(['events'], 'readwrite');
                    const store = tx.objectStore('events');
                    const req = store.delete(id);
                    req.onsuccess = () => resolve();
                    req.onerror = (e) => reject(normalizeIDBError(e));
                    tx.onabort = tx.onerror = (te) => reject(normalizeIDBError(te));
                } catch (ex) {
                    reject(normalizeIDBError(ex));
                }
            });
        });
    };

    const saveSession = () => {
        if (db) {
            const transaction = db.transaction([POMODORO_CONFIG.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(POMODORO_CONFIG.STORE_NAME);
            store.add({ timestamp: new Date() });
            setSessions(prev => prev + 1);
        }
    };

    const clearSessions = () => {
        if (db) {
            const transaction = db.transaction([POMODORO_CONFIG.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(POMODORO_CONFIG.STORE_NAME);
            const req = store.clear();
            req.onsuccess = () => {
                setSessions(0);
            };
            req.onerror = (e) => console.error('clearSessions error', e);
        }
    };

    return {
        sessions,
        saveSession,
        clearSessions
        , getEventsForMonth, saveEvent, deleteEvent
        , subjects, loadSubjects, saveSubject, deleteSubject
    };
};