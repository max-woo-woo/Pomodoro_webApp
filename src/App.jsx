import React, { useState, useEffect, useRef } from 'react';
import { TimerDisplay } from './components/TimerComponents';
import CalendarView from './components/CalendarView';
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
  
  const { sessions, saveSession, clearSessions, getEventsForMonth, saveEvent, deleteEvent } = useIndexedDB();
  const dbApi = { getEventsForMonth, saveEvent, deleteEvent };
  const [showCalendar, setShowCalendar] = useState(false);
  const audioCtxRef = useRef(null);
  const [suppressTimerTransition, setSuppressTimerTransition] = useState(false);

  // play a short beep using Web Audio API via a persistent AudioContext created on user gesture
  const playBeep = () => {
    try {
      const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      // use triangle wave (softer) and lower peak gain
      o.type = 'triangle';
      // slightly lower pitch for a warmer tone
      o.frequency.value = 520; // around C5
      // start with a very small gain; we'll ramp up quickly to audible level
      g.gain.value = 0.00001;
      o.connect(g);
      g.connect(ctx.destination);
      const now = ctx.currentTime;
      g.gain.setValueAtTime(0.00001, now);
      // ADSR-like envelope: quick attack to a higher peak, slow decay to a softer sustain, then release
      // attack -> to a stronger perceptible level
      g.gain.linearRampToValueAtTime(0.16, now + 0.03);
      // decay -> down to a sustain level over ~400ms
      g.gain.exponentialRampToValueAtTime(0.02, now + 0.45);
      // hold sustain for a short while then release
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.05);
      o.start(now);
      // stop oscillator slightly after the release to avoid clicks
      o.stop(now + 1.2);
      if (!audioCtxRef.current) audioCtxRef.current = ctx;
    } catch (e) {
      console.debug('beep failed', e);
    }
  };

  // Called when timer completes: play beep, persist session and return to home smoothly
  const onTimerComplete = () => {
    playBeep();
    saveSession();
    // set returning state to trigger timer fade-out, then go home after animation
    setIsReturning(true);
    setTimeout(() => {
      setHasStarted(false);
      setIsReturning(false);
      resetTimer();
    }, 500);
  };

  const { 
    timeLeft, 
    isActive, 
    toggleTimer, 
    resetTimer, 
    formatTime 
  } = useTimer(onTimerComplete);

  const handleStart = () => {
    // create/resume AudioContext on user gesture so later sounds are allowed
    if (!audioCtxRef.current) {
      try { audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* ignore */ }
    }
    setHasStarted(true);
    toggleTimer();
  };

  const closeCalendar = () => {
    // ensure calendar closes and home shows without the timer
    // temporarily disable timer transitions to avoid fade-out animation
    setSuppressTimerTransition(true);
    setShowCalendar(false);
    setHasStarted(false);
    setIsReturning(false);
    // reset the timer display/state
    try { resetTimer(); } catch (e) { /* ignore if not available */ }
    // re-enable transitions on next tick
    setTimeout(() => setSuppressTimerTransition(false), 80);
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
    <div className="pomodoro-container">
      {!showCalendar ? (
        // Home / Timer UI
        <>
          <div className={`initial-view ${hasStarted || isReturning ? 'fade-out' : ''}`}>
            <button className="arrow-btn arrow-left" onClick={() => setShowCalendar(true)}>◀</button>
            <h1 className="title">Pomodomax</h1>
            <button className="start-button" onClick={handleStart}>
              Start
            </button>
            <button className="start-button" onClick={clearSessions} style={{marginTop:12, fontSize:12, height:36, width:160}}>Clear sessions</button>
          </div>

          <div className={`timer-view ${hasStarted && !isReturning ? 'fade-in' : ''} ${isReturning ? 'fade-out' : ''} ${suppressTimerTransition ? 'no-transition' : ''}`}>
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

          <div className="sessions-home">
            <div>Sessions terminées : {sessions}</div>
          </div>
        </>
      ) : (
        // Calendar only UI
        <>
          <button className="arrow-btn arrow-right" onClick={closeCalendar}>▶</button>
          <div className="calendar-overlay">
            <CalendarView onClose={closeCalendar} dbApi={dbApi} />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
