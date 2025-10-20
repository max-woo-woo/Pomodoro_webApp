import React, { useState, useEffect } from 'react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatDate = (y, m, d) => {
  const mm = String(m + 1).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
};

export const CalendarView = ({ onClose, dbApi }) => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState([]);

  const load = async (y, m) => {
    if (dbApi && dbApi.getEventsForMonth) {
      try {
        const ev = await dbApi.getEventsForMonth(y, m);
        setEvents(ev || []);
      } catch (e) {
        console.error('failed load events', e);
      }
    }
  };

  useEffect(() => { load(year, month); }, [year, month]);

  const startOfMonth = new Date(year, month, 1);
  const startWeekday = startOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  // leading blanks
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => {
    const dt = new Date(year, month - 1, 1);
    setYear(dt.getFullYear());
    setMonth(dt.getMonth());
  };
  const nextMonth = () => {
    const dt = new Date(year, month + 1, 1);
    setYear(dt.getFullYear());
    setMonth(dt.getMonth());
  };

  const handleAddEvent = async (day) => {
    const title = window.prompt('Titre de l\'événement:');
    if (!title) return;
    const dateStr = formatDate(year, month, day);
    try {
      const saved = await dbApi.saveEvent({ date: dateStr, title });
      setEvents(prev => [...prev, saved]);
    } catch (e) {
      console.error('save event failed', e);
    }
  };

  const eventsFor = (day) => {
    const dateStr = formatDate(year, month, day);
    return events.filter(e => e.date === dateStr);
  };

  return (
    <div className="calendar-root">
      <div className="calendar-header">
        <button className="nav-left" onClick={prevMonth}>◀</button>
        <div className="calendar-title">{startOfMonth.toLocaleString(undefined, { month: 'long' })} {year}</div>
        <button className="nav-right" onClick={nextMonth}>▶</button>
        <button className="close-calendar" onClick={onClose}>✕</button>
      </div>

      <div className="calendar-grid">
        <div className="calendar-weekdays">
          {WEEKDAYS.map(w => <div key={w} className="weekday">{w}</div>)}
        </div>

        <div className="calendar-cells">
          {cells.map((day, idx) => (
            <div key={idx} className={`calendar-cell ${day ? '' : 'empty'}`} onClick={() => day && handleAddEvent(day)}>
              {day && <div className="cell-day">{day}</div>}
              {day && (
                <div className="cell-events">
                  {eventsFor(day).map(ev => (
                    <div key={ev.id} className="event-item">{ev.title}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
