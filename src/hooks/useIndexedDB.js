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
    };
};