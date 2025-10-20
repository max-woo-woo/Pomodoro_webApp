import { useState, useEffect } from 'react';
import { POMODORO_CONFIG } from '../config/constants';

export const useIndexedDB = () => {
    const [db, setDb] = useState(null);
    const [sessions, setSessions] = useState(0);

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
            };

            request.onsuccess = (event) => {
                const db = event.target.result;
                setDb(db);
                loadSessions(db);
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
            transaction.onerror = (err) => reject(err);
        });
    };

    const saveEvent = (event) => {
        // event: { date: 'YYYY-MM-DD', title: '...' }
        if (!db) return Promise.reject(new Error('DB not initialized'));
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['events'], 'readwrite');
            const store = transaction.objectStore('events');
            const req = store.add(event);
            req.onsuccess = (ev) => resolve({ ...event, id: ev.target.result });
            req.onerror = (e) => reject(e);
        });
    };

    const deleteEvent = (id) => {
        if (!db) return Promise.reject(new Error('DB not initialized'));
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['events'], 'readwrite');
            const store = transaction.objectStore('events');
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e);
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
    };
};