export const POMODORO_CONFIG = {
    DEFAULT_MINUTES: 25,
    DB_NAME: 'PomodoroDb',
    DB_VERSION: 1,
    STORE_NAME: 'sessions'
};

// Convertit les minutes en secondes
export const minutesToSeconds = (minutes) => minutes * 60;