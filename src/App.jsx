import React, { useState, useEffect, useRef } from 'react';
import { TimerDisplay } from './components/TimerComponents';
import { useIndexedDB } from './hooks/useIndexedDB';
import { useTimer } from './hooks/useTimer';
import './App.css';

function App() {
  const DEBUG = false; // set to true to show debug overlay and logs
  const [hasStarted, setHasStarted] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef(null); // will hold requestAnimationFrame id
  const holdStartRef = useRef(0);
  const [isReturning, setIsReturning] = useState(false);
  
  const { sessions, saveSession } = useIndexedDB();
  const { 
    timeLeft, 
    isActive, 
    toggleTimer, 
    resetTimer, 
    formatTime 
  } = useTimer(saveSession);

  const handleStart = () => {
    setHasStarted(true);
    toggleTimer();
  };

  const handleMouseMove = (e) => {
    // Only update mouse position while holding to avoid extra renders
    if (hasStarted && isHolding) {
      setMousePosition({
        x: e.clientX,
        y: e.clientY
      });
    }
  };

  const handleMouseDown = (e) => {
    if (hasStarted) {
      // Ensure circle appears at the cursor immediately
      setMousePosition({ x: e.clientX, y: e.clientY });
      // Start hold using requestAnimationFrame for smoother updates and fewer timers
      holdStartRef.current = Date.now();
      setIsHolding(true);
      setHoldProgress(0.02);

      const step = () => {
        const progress = (Date.now() - holdStartRef.current) / 3000;
        if (DEBUG) console.debug('hold step', progress);
        if (progress >= 1) {
          // finalize progress and start return transition
          setHoldProgress(1);
          setIsHolding(false);
          holdTimerRef.current = null;
          setIsReturning(true);
          // After fade-out of timer, show home
          setTimeout(() => {
            setHasStarted(false);
            setIsReturning(false);
            resetTimer();
          }, 500);
        } else {
          setHoldProgress(progress);
          holdTimerRef.current = requestAnimationFrame(step);
        }
      };

      holdTimerRef.current = requestAnimationFrame(step);
    }
  };

  const handleMouseUp = () => {
    if (holdTimerRef.current) {
      cancelAnimationFrame(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setIsHolding(false);
    setHoldProgress(0);
  };

  // Pointer event handlers (cover mouse, touch, pen) for more reliable capture
  const handlePointerDown = (e) => {
    // Only start hold when timer is active
    if (hasStarted) {
      e.preventDefault();
      e.stopPropagation();
      if (DEBUG) console.debug('pointerdown', e.clientX, e.clientY);
      // ensure immediate circle placement
      setMousePosition({ x: e.clientX, y: e.clientY });
      handleMouseDown(e);
    }
  };

  const handlePointerMove = (e) => {
    if (hasStarted && isHolding) {
      e.preventDefault();
      if (DEBUG) console.debug('pointermove', e.clientX, e.clientY);
      setMousePosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePointerUp = () => {
    handleMouseUp();
  };

  // Nettoyer le timer quand le composant est démonté
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        cancelAnimationFrame(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };
  }, []);

  // Register global pointer listeners while the timer view is active
  useEffect(() => {
    if (hasStarted) {
      window.addEventListener('pointerdown', handlePointerDown);
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointerdown', handlePointerDown);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
    return undefined;
  }, [hasStarted, isHolding]);

  // Precompute progress circle values
  const CIRCLE_R = 18;
  const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;
  const clampedProgress = Math.max(0, Math.min(1, holdProgress));
  const dash = CIRCUMFERENCE * clampedProgress;

  return (
    <div 
      className="pomodoro-container"
    >
      <div className={`initial-view ${hasStarted || isReturning ? 'fade-out' : ''}`}>
        <h1 className="title">Pomodomax</h1>
        <button className="start-button" onClick={handleStart}>
          Start
        </button>
      </div>
      
      <div className={`timer-view ${hasStarted && !isReturning ? 'fade-in' : ''} ${isReturning ? 'fade-out' : ''}`}>
        <TimerDisplay time={formatTime(timeLeft)} />
      </div>

      {isHolding && (
        <svg 
          className="progress-circle"
          style={{
            left: mousePosition.x - 20,
            top: mousePosition.y - 20
          }}
          width="40"
          height="40"
          viewBox="0 0 40 40"
        >
          <circle
            cx="20"
            cy="20"
            r="18"
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="2"
          />
          <circle
            cx="20"
            cy="20"
            r="18"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
            transform="rotate(-90 20 20)"
          />
        </svg>
      )}
      {DEBUG && (
        <div className="debug-overlay">
          <div>timeLeft: {timeLeft}</div>
          <div>isActive: {isActive ? 'true' : 'false'}</div>
          <div>isHolding: {isHolding ? 'true' : 'false'}</div>
          <div>holdProgress: {Math.round(holdProgress * 100)}%</div>
        </div>
      )}
    </div>
  );
}

export default App;
