import React, { useState, useEffect } from 'react';
import './Calendar.css';
import {
  fetchEvents,
  createEvent,
  deleteEvent,
  fetchScheduleItems
} from './CalendarService.js';

export default function Calendar() {
  const [events, setEvents] = useState([]);
  const [scheduleItems, setScheduleItems] = useState([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));

  const [modalOpen, setModalOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedScheduleItem, setSelectedScheduleItem] = useState(null);

  useEffect(() => {
    loadEvents();
    loadScheduleItems();
  }, []);

  async function loadEvents() {
    const data = await fetchEvents();
    setEvents(data);
  }

  async function loadScheduleItems() {
    const data = await fetchScheduleItems();
    setScheduleItems(data);
  }

  function getStartOfWeek(date) {
    const newDate = new Date(date);
    const day = newDate.getDay();
    const diff = newDate.getDate() - day;
    return new Date(newDate.setDate(diff));
  }

  const getWeekDates = (startDate) => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      return date;
    });
  };

  const weekDates = getWeekDates(currentWeekStart);

  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const today = new Date();
  const hours = Array.from({ length: 24 }, (_, i) => i);

  /* ADD EVENT */

  const addEvent = async () => {
    if (!eventTitle || !eventDate || !eventTime) return;

    const [hour, minute] = eventTime.split(':').map(Number);

    const newEvent = {
      title: eventTitle,
      date: eventDate,
      hour,
      minute
    };

    const created = await createEvent(newEvent);

    if (created) {
      setEvents(prev => [...prev, created]);
    }

    setEventTitle('');
    setEventDate('');
    setEventTime('');
    setModalOpen(false);
  };

  /* DELETE EVENT */

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;

    const confirmDelete = window.confirm(
      `Delete "${selectedEvent.title}"?`
    );

    if (!confirmDelete) return;

    const success = await deleteEvent(selectedEvent.id);

    if (success) {
      setEvents(prev => prev.filter(e => e.id !== selectedEvent.id));
      setSelectedEvent(null);
    }
  };

  const getEventsForCell = (date, hour) => {
    return events
      .filter(e => {
        const eDate = new Date(e.date);
        return (
          eDate.getFullYear() === date.getFullYear() &&
          eDate.getMonth() === date.getMonth() &&
          eDate.getDate() === date.getDate() &&
          e.hour === hour
        );
      })
      .map(e => ({
        ...e,
        topPercent: (e.minute / 60) * 100
      }));
  };

  const getScheduleItemsForCell = (date, hour) => {
    return scheduleItems
      .filter(s => {
        return (
          s.datetime.getFullYear() === date.getFullYear() &&
          s.datetime.getMonth() === date.getMonth() &&
          s.datetime.getDate() === date.getDate() &&
          s.hour === hour
        );
      })
      .map(s => ({
        ...s,
        topPercent: (s.minute / 60) * 100
      }));
  };

  return (
    <div className="calendar-page">
      <h1>Weekly Calendar</h1>

      <div className="calendar-nav">
        <button onClick={goToPreviousWeek}>Prev</button>

        <span className="week-range">
          {weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()}
        </span>

        <button onClick={goToNextWeek}>Next</button>

        <button onClick={() => setModalOpen(true)}>
          Add Event
        </button>
      </div>

      <div className="week-grid compact">
        <div className="time-column-header"></div>

        {weekDates.map((date, index) => (
          <div key={index} className="day-header">
            {date.toLocaleDateString('en-US', {
              weekday: 'short',
              day: 'numeric'
            })}
          </div>
        ))}

        {hours.map(hour => (
          <React.Fragment key={hour}>
            <div className="time-column">{hour}:00</div>

            {weekDates.map((date, index) => {
              const isToday = isSameDay(date, today);
              const cellEvents = getEventsForCell(date, hour);
              const cellScheduleItems = getScheduleItemsForCell(date, hour);

              return (
                <div
                  key={index}
                  className={`hour-cell ${isToday ? 'today' : ''}`}
                >
                  {cellEvents.map((e, i) => (
                    <div
                      key={i}
                      className="event"
                      style={{
                        top: `${e.topPercent}%`,
                        position: 'absolute',
                        width: '95%',
                        cursor: 'pointer'
                      }}
                      onClick={() => setSelectedEvent(e)}
                    >
                      {e.title} ({e.hour}:{e.minute
                        .toString()
                        .padStart(2,'0')})
                    </div>
                  ))}

                  {cellScheduleItems.map((s, i) => (
                    <div
                      key={i}
                      className="event schedule-item"
                      style={{
                        top: `${s.topPercent}%`,
                        position: 'absolute',
                        width: '95%',
                        cursor: 'pointer'
                      }}
                      onClick={() => setSelectedScheduleItem(s)}
                    >
                      {s.itemTitle} ({s.hour}:{s.minute
                        .toString()
                        .padStart(2,'0')})
                    </div>
                  ))}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* ADD EVENT MODAL */}

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Add Event</h2>

            <input
              type="text"
              placeholder="Event title"
              value={eventTitle}
              onChange={e => setEventTitle(e.target.value)}
            />

            <input
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
            />

            <input
              type="time"
              value={eventTime}
              onChange={e => setEventTime(e.target.value)}
            />

            <div className="modal-buttons">
              <button onClick={() => setModalOpen(false)}>
                Close
              </button>

              <button onClick={addEvent}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EVENT DETAILS MODAL */}

      {selectedEvent && (
        <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{selectedEvent.title}</h2>

            <p>
              {selectedEvent.date} – {selectedEvent.hour}:
              {selectedEvent.minute.toString().padStart(2,'0')}
            </p>

            <div className="modal-buttons">
              <button onClick={() => setSelectedEvent(null)}>
                Close
              </button>

              <button
                style={{ background: "#e54848", color: "white" }}
                onClick={handleDeleteEvent}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULE ITEM MODAL */}

      {selectedScheduleItem && (
        <div className="modal-overlay" onClick={() => setSelectedScheduleItem(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{selectedScheduleItem.itemTitle}</h2>

            <p className="schedule-item-time">
              {selectedScheduleItem.datetime.toLocaleDateString()} –{' '}
              {selectedScheduleItem.hour}:
              {selectedScheduleItem.minute.toString().padStart(2,'00')}
            </p>

            <div className="schedule-item-fields">
              {selectedScheduleItem.fields.map((field, i) => (
                field.value ? (
                  <div key={i} className="schedule-item-field">
                    <span className="field-label">{field.categoryTitle}:</span>
                    <span className="field-value">{field.value}</span>
                  </div>
                ) : null
              ))}
            </div>

            <div className="modal-buttons">
              <button onClick={() => setSelectedScheduleItem(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function isSameDay(d1, d2) {
  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  );
}