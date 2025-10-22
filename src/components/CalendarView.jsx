import React, { useState, useEffect, useRef } from 'react';
import { POMODORO_CONFIG } from '../config/constants';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatDate = (y, m, d) => {
  const mm = String(m + 1).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
};

export const CalendarView = ({ onClose, dbApi, subjects = [] }) => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDay, setModalDay] = useState(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalColor, setModalColor] = useState('#6c5ce7');
  const [editingEvent, setEditingEvent] = useState(null);
  const colorInputRef = useRef(null);

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

  const openAddModal = (day) => {
    setModalDay(day);
    setModalTitle('');
    setModalColor('#6c5ce7');
    setEditingEvent(null);
    setModalOpen(true);
  };

  const openEditModal = (eventObj) => {
    const evDate = new Date(eventObj.date);
    setModalDay(evDate.getDate());
    setModalTitle(eventObj.title || '');
    setModalColor(eventObj.color || '#6c5ce7');
    setEditingEvent(eventObj);
    setModalOpen(true);
  };

  const handleSaveModal = async () => {
    if (!modalTitle || !modalDay) {
      alert('Veuillez saisir un titre pour l\'événement.');
      return;
    }
    const dateStr = formatDate(year, month, modalDay);
    try {
      const saved = await dbApi.saveEvent({ date: dateStr, title: modalTitle, color: modalColor });
      setEvents(prev => [...prev, saved]);
      setModalOpen(false);
      // small confirmation
      setTimeout(() => alert('Événement enregistré.'), 20);
    } catch (e) {
      console.error('save event failed', e);
      let msg = 'Unknown error';
      try {
        if (!e) msg = 'no error object';
        else if (e.message) msg = e.message;
        else msg = JSON.stringify(e);
      } catch (ex) { msg = String(e); }
      alert(`Échec de l'enregistrement : ${msg}. Voir console pour le stack.`);
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
                <div key={idx} className={`calendar-cell ${day ? '' : 'empty'}`} onClick={() => day && openAddModal(day)}>
                  {day && <div className="cell-day">{day}</div>}
                  {day && (
                    <div className="cell-events">
                      {eventsFor(day).map(ev => (
                        <div key={ev.id} className="event-item" style={{ background: ev.color || 'rgba(255,255,255,0.06)' }} onClick={(e) => { e.stopPropagation(); openEditModal(ev); }}>{ev.title}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
        </div>
      </div>
      {modalOpen && (
        <div className="event-modal-overlay">
          <div className="event-modal">
            <h3>Nouvel événement — {modalDay}/{month+1}/{year}</h3>
            <label>Titre</label>
            <input value={modalTitle} onChange={e => setModalTitle(e.target.value)} />
            <label>Sujet</label>
            <select value={''} onChange={e => {
              const sid = e.target.value;
              if (!sid) return;
              const s = subjects.find(x => String(x.id) === String(sid));
              if (s) setModalColor(s.color || '#6c5ce7');
            }}>
              <option value="">(aucun)</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label>Couleur</label>
            <div className="color-chooser">
              <input ref={colorInputRef} type="color" value={modalColor} onChange={e => setModalColor(e.target.value)} />
              <div className="color-preview" style={{ background: modalColor }} aria-hidden="true" onClick={() => colorInputRef.current && colorInputRef.current.click()} />
              <button className="color-validate" onClick={() => { /* no-op: removed alert per user request */ }}>Valider couleur</button>
            </div>
            <div className="modal-actions">
              <button onClick={() => { setModalOpen(false); setEditingEvent(null); }}>Annuler</button>
              {editingEvent ? (
                <>
                  <button onClick={async () => {
                    // delete event
                    if (!editingEvent || !editingEvent.id) return;
                    if (!confirm('Supprimer cet événement ?')) return;
                    try {
                      await dbApi.deleteEvent(editingEvent.id);
                      setEvents(prev => prev.filter(x => x.id !== editingEvent.id));
                      setModalOpen(false);
                      setEditingEvent(null);
                    } catch (err) {
                      console.error('delete event failed', err);
                      alert('Échec suppression événement');
                    }
                  }}>Supprimer</button>
                  <button onClick={async () => {
                    // save changes to existing event (PUT)
                    const dateStr = formatDate(year, month, modalDay);
                    const updated = { ...editingEvent, date: dateStr, title: modalTitle, color: modalColor };
                    try {
                      const saved = await dbApi.saveEvent(updated);
                      setEvents(prev => prev.map(x => x.id === saved.id ? saved : x));
                      setModalOpen(false);
                      setEditingEvent(null);
                    } catch (err) {
                      console.error('update event failed', err);
                      alert('Échec mise à jour événement');
                    }
                  }} disabled={!modalTitle}>Enregistrer</button>
                </>
              ) : (
                <button onClick={handleSaveModal} disabled={!modalTitle}>Enregistrer</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
