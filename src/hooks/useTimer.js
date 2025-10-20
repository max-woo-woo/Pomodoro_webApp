import { useState, useEffect, useRef } from 'react';
import { POMODORO_CONFIG, minutesToSeconds } from '../config/constants';

export const useTimer = (onComplete) => {
    const defaultTime = minutesToSeconds(POMODORO_CONFIG.DEFAULT_MINUTES);
    const [timeLeft, setTimeLeft] = useState(defaultTime);
    const [isActive, setIsActive] = useState(false);
    const completedRef = useRef(false);

    useEffect(() => {
        let interval = null;

        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(time => time - 1);
            }, 1000);
        } else if (timeLeft === 0 && !completedRef.current) {
            // call onComplete only once per completion
            completedRef.current = true;
            setIsActive(false);
            if (typeof onComplete === 'function') onComplete();
        }

        return () => clearInterval(interval);
    }, [isActive, timeLeft, onComplete]);

    const toggleTimer = () => {
        setIsActive(!isActive);
    };

    const resetTimer = () => {
        setIsActive(false);
        setTimeLeft(defaultTime);
        completedRef.current = false;
    };

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    return {
        timeLeft,
        isActive,
        toggleTimer,
        resetTimer,
        formatTime
    };
};