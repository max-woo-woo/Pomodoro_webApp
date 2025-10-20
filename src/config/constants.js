export const POMODORO_CONFIG = {
    // For testing: 10 seconds = 10/60 minutes = 0.1666667
    DEFAULT_MINUTES: 0.1,
    DB_NAME: 'PomodoroDb',
    DB_VERSION: 1,
    STORE_NAME: 'sessions'
};

// Convertit les minutes en secondes
export const minutesToSeconds = (minutes) => minutes * 60;