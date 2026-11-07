
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import {
  appointmentService,
  REMINDER_LEAD_OPTIONS,
  isReminderEventType,
  reminderLeadLabel,
  localDateKey,
  localTimeValue,
  expandRecurrence,
  recurrenceProblem,
  describeRecurrence,
  eventDescription,
  medicinesSummary,
} from '../../services/appointmentService';
import type {
  Appointment,
  Recurrence,
  RecurrenceFrequency,
  SeriesInput,
  SeriesMedicine,
} from '../../services/appointmentService';

// The "Repeat" part of the event form.
type RepeatForm = {
  enabled: boolean;
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays: number[];
  times: string[];
  endMode: 'count' | 'date';
  count: number;
  endDate: string;
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const addDaysToKey = (key: string, days: number): string => {
  const [y, m, d] = key.split('-').map(Number);
  const next = new Date(y, m - 1, d + days);
  return localDateKey(next.toISOString());
};

const emptyRepeat = (startDate: string, time: string): RepeatForm => ({
  enabled: false,
  frequency: 'daily',
  interval: 2,
  weekdays: [new Date(`${startDate}T00:00`).getDay()],
  times: [time || '09:00'],
  endMode: 'count',
  count: 21,
  endDate: addDaysToKey(startDate, 20),
});

const toRecurrence = (repeat: RepeatForm, startDate: string): Recurrence => ({
  frequency: repeat.frequency,
  interval: repeat.frequency === 'interval' ? repeat.interval : undefined,
  weekdays: repeat.frequency === 'weekly' ? repeat.weekdays : undefined,
  startDate,
  endDate: repeat.endMode === 'date' ? repeat.endDate : undefined,
  count: repeat.endMode === 'count' ? repeat.count : undefined,
  times: repeat.times,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

const fromRecurrence = (rec: Recurrence): RepeatForm => ({
  enabled: true,
  frequency: rec.frequency,
  interval: rec.interval ?? 2,
  weekdays: rec.weekdays ?? [],
  times: rec.times?.length ? rec.times : ['09:00'],
  endMode: rec.endDate ? 'date' : 'count',
  count: rec.count ?? 21,
  endDate: rec.endDate ?? addDaysToKey(rec.startDate, 20),
});

const isMedicineType = (type?: string) => type === 'medication' || type === 'injection';
import UserSelector from '../../components/feature/UserSelector';
import MultiUserSelector from '../../components/feature/MultiUserSelector';
import MedicalRecordModal from '../../components/feature/MedicalRecordModal';
import { supabase } from '../../lib/supabase';
import CalendarFilterBar from './components/CalendarFilterBar';
import MonthView from './components/MonthView';
import TimeGridView from './components/TimeGridView';
import ListView from './components/ListView';
import DayPanel from './components/DayPanel';
import {
  applyFilters,
  eventDayKey,
  eventStartMs,
  isDose,
  loadFilters,
  saveFilters,
  todayKey,
  typeDef,
  usePeople,
  weekDays,
} from './calendarUtils';
import type { CalendarFilters } from './calendarUtils';

const CalendarPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'list'>('month');
  // Who / what the calendar shows (remembered in this browser), everyone's
  // names, and the day whose full list is open in the side panel.
  const [filters, setFilters] = useState<CalendarFilters>(loadFilters);
  const people = usePeople();
  const [openDayKey, setOpenDayKey] = useState<string | null>(null);
  const closeDayPanel = useCallback(() => setOpenDayKey(null), []);
  const [selectedEvent, setSelectedEvent] = useState<Appointment | null>(null);
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [events, setEvents] = useState<Appointment[]>([]);
  const [showMedicalModal, setShowMedicalModal] = useState(false);
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});

  // Push reminders for the event being created / edited: minutes before the
  // event at which the user is notified on their phone.
  const [reminderLeads, setReminderLeads] = useState<number[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'warning'; message: string } | null>(null);
  const [selectedEventLeads, setSelectedEventLeads] = useState<number[] | null>(null);

  // Repeating schedules: the form's Repeat section and medicine list, the
  // series being edited (null when creating or editing a single event), and
  // the schedule of the event open in the detail view.
  const [repeat, setRepeat] = useState<RepeatForm>(() =>
    emptyRepeat(localDateKey(new Date().toISOString()), '09:00')
  );
  const [medicines, setMedicines] = useState<SeriesMedicine[]>([]);
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<(SeriesInput & { id: string }) | null>(null);

  // New Event Form State
  const [formData, setFormData] = useState<Partial<Appointment>>({
    title: '',
    type: 'consultation',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    duration: '60 min',
    participants: [],
    location: 'Clinic',
    status: 'scheduled',
    notes: '',
    userId: ''
  });

  const fetchEvents = async () => {
    try {
      const data = await appointmentService.getAllAppointments();
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load events', err);
      setEvents([]);
    } finally {
      // Done fetching
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => saveFilters(filters), [filters]);

  const filteredEvents = useMemo(() => applyFilters(events, filters), [events, filters]);

  // Per client review: pop up a notification 1 hour before each calendar
  // event. Re-evaluate every minute against today's events. Once an event has
  // been reminded for, remember it for the rest of the session so we don't
  // spam the admin.
  useEffect(() => {
    if (events.length === 0) return;

    const remindedKey = 'fms_calendar_reminded_v1';
    const loadReminded = (): Set<string> => {
      try {
        const raw = sessionStorage.getItem(remindedKey);
        if (!raw) return new Set();
        return new Set(JSON.parse(raw));
      } catch {
        return new Set();
      }
    };
    const saveReminded = (s: Set<string>) => {
      try { sessionStorage.setItem(remindedKey, JSON.stringify([...s])); } catch { /* ignore */ }
    };

    // Best-effort: ask permission once so OS-level notifications can fire.
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch { /* ignore */ }
    }

    const tick = () => {
      const reminded = loadReminded();
      const now = Date.now();
      // 1 hour window with a 60s grace period so the tick interval can catch it.
      const WINDOW_MS = 60 * 60 * 1000;
      const GRACE_MS = 60 * 1000;

      for (const ev of events) {
        if (!ev.id || reminded.has(ev.id)) continue;
        // A repeating schedule (e.g. daily medication) is the user's to follow;
        // alerting the admin before every dose would be noise.
        if (ev.seriesId) continue;
        const isoDate = (ev as any).date as string | undefined;
        const time = (ev as any).time as string | undefined;
        const startStr = time && isoDate && !isoDate.includes('T')
          ? `${isoDate}T${time}`
          : isoDate;
        if (!startStr) continue;
        const start = Date.parse(startStr);
        if (Number.isNaN(start)) continue;
        const delta = start - now;
        if (delta > WINDOW_MS - GRACE_MS && delta < WINDOW_MS + GRACE_MS) {
          const title = ev.title || 'Upcoming appointment';
          const whenLabel = new Date(start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          const body = `${title} in 1 hour (at ${whenLabel}).`;

          // OS notification when allowed
          if ('Notification' in window && Notification.permission === 'granted') {
            try { new Notification('Appointment reminder', { body }); } catch { /* ignore */ }
          }
          // In-page fallback so it works even without OS notifications.
          // eslint-disable-next-line no-alert
          window.alert(`⏰ Appointment reminder\n${body}`);

          reminded.add(ev.id);
          saveReminded(reminded);
        }
      }
    };

    tick();
    const handle = setInterval(tick, 60 * 1000);
    return () => clearInterval(handle);
  }, [events]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge color="green">Confirmed</Badge>;
      case 'pending':
        return <Badge color="yellow">Pending</Badge>;
      case 'scheduled':
        return <Badge color="blue">Scheduled</Badge>;
      case 'completed':
        return <Badge color="gray">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Previous / next month, week or day, depending on the view.
  const navigate = (direction: 'prev' | 'next') => {
    const step = direction === 'prev' ? -1 : 1;
    setCurrentDate(prev => {
      if (viewMode === 'week') return new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7 * step);
      if (viewMode === 'day') return new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + step);
      return new Date(prev.getFullYear(), prev.getMonth() + step, 1);
    });
  };

  const periodLabel = (() => {
    if (viewMode === 'week') {
      const days = weekDays(currentDate);
      const first = days[0];
      const last = days[6];
      const sameMonth = first.getMonth() === last.getMonth();
      return `${first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}, ${last.getFullYear()}`;
    }
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    if (viewMode === 'list') return 'Agenda';
    return currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  })();

  const emptyForm = (): Partial<Appointment> => ({
    title: '',
    type: 'consultation',
    date: localDateKey(new Date().toISOString()),
    time: '09:00',
    duration: '60 min',
    participants: [],
    location: 'Clinic',
    status: 'scheduled',
    notes: '',
    userId: ''
  });

  const openNewEventModal = (dateKey?: string) => {
    const form = { ...emptyForm(), ...(dateKey ? { date: dateKey } : {}) };
    setFormData(form);
    setReminderLeads([]);
    setRepeat(emptyRepeat(form.date!, form.time!));
    setMedicines([]);
    setEditingSeriesId(null);
    setFormError(null);
    setShowNewEventModal(true);
  };

  const closeEventModal = () => {
    setShowNewEventModal(false);
    setEditingSeriesId(null);
  };

  const updateRepeat = (changes: Partial<RepeatForm>) => setRepeat(prev => ({ ...prev, ...changes }));

  const updateMedicine = (index: number, changes: Partial<SeriesMedicine>) =>
    setMedicines(prev => prev.map((m, i) => (i === index ? { ...m, ...changes } : m)));

  // The schedule being entered, when the event repeats.
  const recurrence = repeat.enabled && formData.date ? toRecurrence(repeat, formData.date) : null;
  const plannedStarts = recurrence ? expandRecurrence(recurrence) : [];

  const toggleReminderLead = (minutes: number) => {
    setReminderLeads(prev =>
      prev.includes(minutes) ? prev.filter(m => m !== minutes) : [...prev, minutes]
    );
  };

  const handleTypeChange = (type: string) => {
    setFormData(prev => ({ ...prev, type }));
    // A medication / injection / reminder exists to notify the user, so start
    // with sensible push reminders the admin can still change.
    // A repeating one (daily medication) only needs the at-the-time push;
    // "1 day before" would also notify her the evening before every dose.
    if (isReminderEventType(type) && reminderLeads.length === 0) {
      setReminderLeads(repeat.enabled ? [0] : [1440, 0]);
    }
  };

  const handleCreateEvent = async () => {
    setFormError(null);

    if (!formData.title?.trim()) {
      setFormError('Please enter a title.');
      return;
    }
    if (!formData.date) {
      setFormError('Please choose a date.');
      return;
    }
    const attendees = [formData.userId, ...(formData.participants || [])].filter(Boolean);
    if (reminderLeads.length > 0 && attendees.length === 0) {
      setFormError('Choose the user to notify before scheduling push reminders.');
      return;
    }

    if (recurrence) {
      await saveSeries(recurrence, attendees.length);
      return;
    }

    setIsSaving(true);
    let eventId: string | undefined = formData.id;
    try {
        if (formData.id) {
            await appointmentService.updateAppointment(formData.id, formData as any);
        } else {
            // A one-off medication / injection: the medicines go at the start of
            // the description, where the push reminder shows them.
            const notes = isMedicineType(formData.type)
              ? eventDescription(medicines, formData.notes)
              : formData.notes;
            eventId = await appointmentService.createAppointment({ ...formData, notes } as any);
        }
    } catch (error) {
        console.error("Failed to save event", error);
        setFormError('Could not save the event. Please try again.');
        setIsSaving(false);
        return;
    }

    // The event is saved; now (re)schedule its push reminders. A failure here
    // must not look like the event was lost.
    let nextNotice: { type: 'success' | 'warning'; message: string } | null = null;
    // A brand-new event without reminders has nothing to schedule; an edited
    // one may have reminders to move or remove.
    if (eventId && (reminderLeads.length > 0 || formData.id)) {
      try {
        const result = await appointmentService.setReminders(eventId, reminderLeads);
        if (reminderLeads.length > 0) {
          nextNotice = result.scheduled > 0
            ? {
                type: result.skippedPast > 0 ? 'warning' : 'success',
                message: `Event saved. ${result.scheduled} push reminder${result.scheduled === 1 ? '' : 's'} scheduled${result.skippedPast > 0 ? ` (${result.skippedPast} skipped because that time has already passed)` : ''}.`,
              }
            : { type: 'warning', message: 'Event saved, but no push reminders were scheduled because the selected times have already passed.' };
        }
      } catch (error: any) {
        console.error('Failed to schedule reminders', error);
        if (reminderLeads.length > 0) {
          nextNotice = {
            type: 'warning',
            message: `Event saved, but the push reminders could not be scheduled${error?.message ? `: ${error.message}` : '.'}`,
          };
        }
      }
    }

    await fetchEvents();
    setShowNewEventModal(false);
    setFormData(emptyForm());
    setReminderLeads([]);
    setNotice(nextNotice);
    setIsSaving(false);
  };

  // Create a repeating schedule, or change the one being edited.
  const saveSeries = async (rec: Recurrence, attendeeCount: number) => {
    const problem = recurrenceProblem(rec);
    if (problem) {
      setFormError(problem);
      return;
    }
    if (attendeeCount === 0) {
      setFormError('Choose the surrogate or parent this schedule is for.');
      return;
    }

    const input: SeriesInput = {
      title: formData.title!.trim(),
      type: formData.type || 'reminder',
      location: formData.location,
      notes: formData.notes,
      userId: formData.userId,
      participants: formData.participants || [],
      medicines: isMedicineType(formData.type) ? medicines.filter(m => m.name.trim()) : [],
      recurrence: rec,
      reminderLeads,
    };

    setIsSaving(true);
    try {
      const result = editingSeriesId
        ? await appointmentService.updateSeries(editingSeriesId, input)
        : await appointmentService.createSeries(input);
      const what = editingSeriesId ? 'Schedule updated' : 'Schedule created';
      setNotice({
        type: result.occurrences > 0 ? 'success' : 'warning',
        message: result.occurrences > 0
          ? `${what}: ${result.occurrences} event${result.occurrences === 1 ? '' : 's'} on the calendar` +
            (reminderLeads.length > 0 ? ` with ${result.remindersScheduled} push reminder${result.remindersScheduled === 1 ? '' : 's'}.` : '.')
          : `${what}, but every date in it has already passed, so nothing was added to the calendar.`,
      });
      await fetchEvents();
      setShowNewEventModal(false);
      setEditingSeriesId(null);
      setFormData(emptyForm());
      setReminderLeads([]);
    } catch (error: any) {
      console.error('Failed to save schedule', error);
      setFormError(`Could not save the schedule${error?.message ? `: ${error.message}` : '.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Open the form on the whole schedule of the selected event.
  const handleEditSeries = () => {
    if (!selectedSeries) return;
    const s = selectedSeries;
    setFormData({
      ...emptyForm(),
      title: s.title,
      type: s.type,
      location: s.location,
      notes: s.notes,
      userId: s.userId,
      participants: s.participants,
      date: s.recurrence.startDate,
      time: s.recurrence.times?.[0] || '09:00',
    });
    setRepeat(fromRecurrence(s.recurrence));
    setMedicines(s.medicines);
    setReminderLeads(s.reminderLeads);
    setEditingSeriesId(s.id);
    setFormError(null);
    setShowNewEventModal(true);
    setSelectedEvent(null);
  };

  const handleDeleteUpcoming = async (seriesId: string) => {
    if (!confirm('Delete every upcoming event in this schedule? Past ones stay on the calendar.')) return;
    try {
      const removed = await appointmentService.deleteUpcomingInSeries(seriesId);
      await fetchEvents();
      setSelectedEvent(null);
      setNotice({ type: 'success', message: `Schedule stopped: ${removed} upcoming event${removed === 1 ? '' : 's'} removed.` });
    } catch (error) {
      console.error('Failed to delete schedule', error);
      setNotice({ type: 'warning', message: 'Could not stop the schedule. Please try again.' });
    }
  };

  const handleEditEvent = async () => {
    if (selectedEvent) {
        const event = selectedEvent;
        setFormData({
            ...event,
            // Date and time inputs need the event's local day and 24-hour time.
            date: localDateKey(event.startsAt) || event.date,
            time: localTimeValue(event.startsAt) || event.time?.substring(0, 5) || '09:00'
        });
        // Editing one event (a one-off, or a single occurrence of a schedule).
        setRepeat(emptyRepeat(localDateKey(event.startsAt) || event.date, localTimeValue(event.startsAt)));
        setMedicines([]);
        setEditingSeriesId(null);
        setReminderLeads(selectedEventLeads ?? []);
        setFormError(null);
        setShowNewEventModal(true);
        setSelectedEvent(null);

        // Make sure the form reflects the reminders stored for this event even
        // if they had not finished loading in the detail view.
        if (selectedEventLeads === null && event.id) {
          try {
            setReminderLeads(await appointmentService.getReminderLeads(event.id));
          } catch (error) {
            console.error('Failed to load reminders', error);
          }
        }
    }
  };

  const handleDeleteEvent = async (id: string) => {
      if(!confirm("Are you sure you want to delete this event?")) return;
      try {
          await appointmentService.deleteAppointment(id);
          await fetchEvents();
          setSelectedEvent(null);
      } catch (error) {
          console.error("Failed to delete event", error);
      }
  }

  // Fetch participant names from user IDs
  const fetchParticipantNames = async (userIds: string[]) => {
    const names: Record<string, string> = {};
    const usersToFetch = userIds.filter(id => !participantNames[id]);
    
    if (usersToFetch.length === 0) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .in('id', usersToFetch);

      if (fetchError) throw fetchError;

      if (data) {
        data.forEach((userData: any) => {
          let name = '';
          if (userData.formData) {
            name = [userData.formData.firstName, userData.formData.lastName].filter(Boolean).join(' ');
          }
          if (!name && userData.parent1?.name) {
            name = userData.parent1.name;
          }
          if (!name) {
            name = [userData.firstName, userData.lastName].filter(Boolean).join(' ');
          }
          if (!name) {
            name = userData.email || 'Unknown User';
          }
          names[userData.id] = `${name} (${userData.role || 'User'})`;
        });
      }

      // Add IDs that couldn't be found
      usersToFetch.forEach(id => {
        if (!names[id]) names[id] = id;
      });

      setParticipantNames(prev => ({ ...prev, ...names }));
    } catch (error) {
      console.error('Error fetching user names:', error);
    }
  };

  // Fetch participant names when event is selected
  useEffect(() => {
    if (selectedEvent?.participants && Array.isArray(selectedEvent.participants)) {
      fetchParticipantNames(selectedEvent.participants);
    }
  }, [selectedEvent]);

  // Load the push reminders scheduled for the selected event
  useEffect(() => {
    setSelectedEventLeads(null);
    const eventId = selectedEvent?.id;
    if (!eventId) return;
    let cancelled = false;
    appointmentService.getReminderLeads(eventId)
      .then(leads => { if (!cancelled) setSelectedEventLeads(leads); })
      .catch(error => {
        console.error('Failed to load reminders', error);
        if (!cancelled) setSelectedEventLeads([]);
      });
    return () => { cancelled = true; };
  }, [selectedEvent]);

  // Load the schedule of the selected event, if it repeats
  useEffect(() => {
    setSelectedSeries(null);
    const seriesId = selectedEvent?.seriesId;
    if (!seriesId) return;
    let cancelled = false;
    appointmentService.getSeries(seriesId)
      .then(series => { if (!cancelled) setSelectedSeries(series); })
      .catch(error => console.error('Failed to load schedule', error));
    return () => { cancelled = true; };
  }, [selectedEvent]);

  // Next few events from now. Single doses are left out (they'd fill the
  // list); today's dose count is shown instead.
  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return filteredEvents
      .filter(e => !isDose(e) && e.status === 'scheduled' && eventStartMs(e) >= now)
      .sort((a, b) => eventStartMs(a) - eventStartMs(b))
      .slice(0, 5);
  }, [filteredEvents]);

  const todaysDoseCount = useMemo(() => {
    const key = todayKey();
    return filteredEvents.filter(e => isDose(e) && eventDayKey(e) === key).length;
  }, [filteredEvents]);

  const renderUpcomingEvents = () => (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Upcoming Events</h3>
      <div className="space-y-3">
        {upcomingEvents.map(event => (
          <div
            key={event.id}
            onClick={() => setSelectedEvent(event)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
          >
            <div className={`w-3 h-3 flex-shrink-0 rounded-full ${typeDef(event.type).color}`}></div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 dark:text-white line-clamp-1">{event.title}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {new Date(eventStartMs(event)).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at {event.time}
              </div>
            </div>
            {getStatusBadge(event.status)}
          </div>
        ))}
        {upcomingEvents.length === 0 && (
            <p className="text-gray-500 text-center py-4">No upcoming events</p>
        )}
      </div>
      {todaysDoseCount > 0 && (
        <button
          type="button"
          onClick={() => setOpenDayKey(todayKey())}
          className="mt-4 flex w-full items-center gap-2 rounded-lg bg-teal-50 dark:bg-teal-500/10 px-3 py-2 text-left text-sm font-medium text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-500/20 cursor-pointer"
        >
          <i className="ri-capsule-line"></i>
          {todaysDoseCount} medication dose{todaysDoseCount === 1 ? '' : 's'} today
          <i className="ri-arrow-right-s-line ml-auto"></i>
        </button>
      )}
    </Card>
  );

  return (
    <div className="flex h-screen bg-[#fdf4f6] dark:bg-[#0e0b1a]">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage appointments and schedule events.</p>
              </div>
              <div className="flex gap-3">
                <div className="flex bg-gray-100 dark:bg-[#15111f] rounded-lg p-1">
                  {(['month', 'week', 'day', 'list'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      aria-pressed={viewMode === mode}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer capitalize ${
                        viewMode === mode
                          ? 'bg-white dark:bg-white/5 text-rose-500 dark:text-rose-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <Button color="blue" onClick={() => openNewEventModal()}>
                  <i className="ri-add-line mr-2"></i>
                  New Event
                </Button>
              </div>
            </div>
          </div>

          {notice && (
            <div
              role="status"
              className={`mb-6 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                notice.type === 'success'
                  ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300'
              }`}
            >
              <span className="flex items-start gap-2">
                <i className={`${notice.type === 'success' ? 'ri-notification-3-line' : 'ri-error-warning-line'} mt-0.5`}></i>
                {notice.message}
              </span>
              <button onClick={() => setNotice(null)} aria-label="Dismiss" className="cursor-pointer opacity-70 hover:opacity-100">
                <i className="ri-close-line"></i>
              </button>
            </div>
          )}

          <CalendarFilterBar filters={filters} onChange={setFilters} />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Calendar */}
            <div className="lg:col-span-3">
              <Card>
                {/* Calendar Navigation */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{periodLabel}</h2>
                  {viewMode !== 'list' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate('prev')}
                        aria-label={`Previous ${viewMode}`}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg cursor-pointer"
                      >
                        <i className="ri-arrow-left-line text-gray-600 dark:text-gray-400"></i>
                      </button>
                      <button
                        onClick={() => setCurrentDate(new Date())}
                        className="px-3 py-2 text-sm font-medium text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-white/5 rounded-lg cursor-pointer"
                      >
                        Today
                      </button>
                      <button
                        onClick={() => navigate('next')}
                        aria-label={`Next ${viewMode}`}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg cursor-pointer"
                      >
                        <i className="ri-arrow-right-line text-gray-600 dark:text-gray-400"></i>
                      </button>
                    </div>
                  )}
                </div>

                {viewMode === 'month' && (
                  <MonthView
                    month={currentDate}
                    events={filteredEvents}
                    showDoses={filters.showDoses}
                    onSelectEvent={setSelectedEvent}
                    onOpenDay={setOpenDayKey}
                  />
                )}

                {(viewMode === 'week' || viewMode === 'day') && (
                  <TimeGridView
                    days={viewMode === 'week' ? weekDays(currentDate) : [currentDate]}
                    events={filteredEvents}
                    showDoses={filters.showDoses}
                    people={people}
                    onSelectEvent={setSelectedEvent}
                    onOpenDay={setOpenDayKey}
                  />
                )}

                {viewMode === 'list' && (
                  <ListView
                    events={filteredEvents}
                    showDoses={filters.showDoses}
                    people={people}
                    onSelectEvent={setSelectedEvent}
                  />
                )}
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {renderUpcomingEvents()}
            </div>
          </div>

          {openDayKey && (
            <DayPanel
              dateKey={openDayKey}
              events={filteredEvents.filter(e => eventDayKey(e) === openDayKey)}
              people={people}
              onClose={closeDayPanel}
              onSelectEvent={setSelectedEvent}
              onAddEvent={(dateKey) => { setOpenDayKey(null); openNewEventModal(dateKey); }}
            />
          )}

          {/* Event Detail Modal */}
          {selectedEvent && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-[#15111f] rounded-2xl max-w-lg w-full shadow-2xl">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Event Details</h2>
                    <button
                      onClick={() => setSelectedEvent(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                    >
                      <i className="ri-close-line text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{selectedEvent.title}</h3>
                      <div className="mt-2">{getStatusBadge(selectedEvent.status)}</div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm bg-rose-50/50 dark:bg-white/5 p-4 rounded-lg">
                      <div>
                        <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">Date:</span>
                        <div className="font-medium text-gray-900 dark:text-white">{localDateKey(selectedEvent.startsAt) || selectedEvent.date}</div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">Time:</span>
                        <div className="font-medium text-gray-900 dark:text-white">{selectedEvent.time}</div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">Duration:</span>
                        <div className="font-medium text-gray-900 dark:text-white">{selectedEvent.duration}</div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">Location:</span>
                        <div className="font-medium text-gray-900 dark:text-white">{selectedEvent.location}</div>
                      </div>
                    </div>

                    <div>
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Participants:</span>
                      <div className="mt-2 flex flex-wrap gap-2 text-sm">
                        {(selectedEvent.participants && Array.isArray(selectedEvent.participants) && selectedEvent.participants.length > 0) ? selectedEvent.participants.map((participantId, index) => (
                          <div key={index} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full border border-blue-100 dark:border-blue-800 shadow-sm">
                            <i className="ri-user-line text-xs"></i>
                            <span className="font-medium">{people[participantId]?.name ?? participantNames[participantId] ?? 'Loading...'}</span>
                          </div>
                        )) : (
                            <span className="text-gray-500 italic text-sm">No participants</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Push reminders:</span>
                      <div className="mt-2 flex flex-wrap gap-2 text-sm">
                        {selectedEventLeads === null ? (
                          <span className="text-gray-500 italic text-sm">Loading...</span>
                        ) : selectedEventLeads.length > 0 ? selectedEventLeads.map(minutes => (
                          <div key={minutes} className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 rounded-full border border-amber-100 dark:border-amber-500/20">
                            <i className="ri-notification-3-line text-xs"></i>
                            <span className="font-medium">{reminderLeadLabel(minutes)}</span>
                          </div>
                        )) : (
                          <span className="text-gray-500 italic text-sm">None scheduled</span>
                        )}
                      </div>
                    </div>

                    {selectedEvent.seriesId && (
                      <div className="rounded-lg border border-teal-100 dark:border-teal-500/20 bg-teal-50/60 dark:bg-teal-500/10 p-3 text-sm">
                        <div className="flex items-center gap-2 font-medium text-teal-800 dark:text-teal-300">
                          <i className="ri-repeat-line"></i>
                          Part of a repeating schedule
                        </div>
                        <div className="mt-1 text-gray-700 dark:text-gray-300">
                          {selectedSeries ? describeRecurrence(selectedSeries.recurrence) : 'Loading...'}
                        </div>
                        {selectedSeries && selectedSeries.medicines.length > 0 && (
                          <div className="mt-1 text-gray-700 dark:text-gray-300">
                            Medicines: {medicinesSummary(selectedSeries.medicines)}
                          </div>
                        )}
                      </div>
                    )}

                    {selectedEvent.notes && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400 font-medium">Notes:</span>
                        <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 bg-rose-50/50 dark:bg-white/5 p-3 rounded-lg border border-gray-100 dark:border-white/10">
                          {selectedEvent.notes}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-4">
                      <Button color="blue" className="flex-1" onClick={handleEditEvent}>
                        <i className="ri-edit-line mr-2"></i>
                        {selectedEvent.seriesId ? 'Edit this one' : 'Edit'}
                      </Button>
                      <Button variant="outline" className="flex-1" color="red" onClick={() => selectedEvent.id && handleDeleteEvent(selectedEvent.id)}>
                        <i className="ri-delete-bin-line mr-2"></i>
                        {selectedEvent.seriesId ? 'Delete this one' : 'Delete'}
                      </Button>
                    </div>
                    {selectedEvent.seriesId && (
                      <div className="flex gap-3">
                        <Button color="blue" variant="outline" className="flex-1" onClick={handleEditSeries} disabled={!selectedSeries}>
                          <i className="ri-repeat-line mr-2"></i>
                          Edit schedule
                        </Button>
                        <Button variant="outline" className="flex-1" color="red" onClick={() => handleDeleteUpcoming(selectedEvent.seriesId!)}>
                          <i className="ri-stop-circle-line mr-2"></i>
                          Delete upcoming
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* New Event Modal */}
          {showNewEventModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-[#15111f] rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {editingSeriesId ? 'Edit Schedule' : formData.id ? 'Edit Event' : 'New Event'}
                    </h2>
                    <button
                      onClick={closeEventModal}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                    >
                      <i className="ri-close-line text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {formError && (
                      <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
                        <i className="ri-error-warning-line flex-shrink-0"></i>
                        {formError}
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Event Title
                      </label>
                      <input
                        type="text"
                        value={formData.title || ''}
                        onChange={e => setFormData({...formData, title: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-rose-500 dark:bg-white/5 dark:text-white outline-none"
                        placeholder="Enter event title"
                      />
                    </div>

                    <UserSelector 
                      value={formData.userId || ''} 
                      onChange={val => setFormData({...formData, userId: val})}
                      onSelect={(user) => {
                        // Automatically add selected user ID to participants
                        setFormData(prev => ({
                          ...prev,
                          userId: user.id,
                          participants: [user.id]
                        }));
                      }}
                      label="Associated User (Surrogate/Parent)"
                    />
                    
                    <div className="pt-2">
                       <Button 
                          type="button" 
                          variant="outline" 
                          className="w-full border-dashed border-2 hover:border-blue-500 hover:text-blue-500 transition-all py-3 flex items-center justify-center gap-2"
                          onClick={() => setShowMedicalModal(true)}
                       >
                          <i className="ri-health-book-line"></i>
                          Add New Medical Record for this Event
                       </Button>
                    </div>
                    
                    {editingSeriesId && (
                      <p className="flex items-start gap-2 rounded-lg bg-teal-50/60 dark:bg-teal-500/10 px-3 py-2 text-xs text-teal-800 dark:text-teal-300">
                        <i className="ri-information-line mt-0.5"></i>
                        Saving replaces every upcoming event in this schedule. Events that have already happened stay as they are.
                      </p>
                    )}

                    <div className={repeat.enabled ? '' : 'grid grid-cols-2 gap-4'}>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {repeat.enabled ? 'Start date' : 'Date'}
                        </label>
                        <input
                          type="date"
                          value={formData.date}
                          onChange={e => setFormData({...formData, date: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-rose-500 dark:bg-white/5 dark:text-white outline-none"
                        />
                      </div>
                      {!repeat.enabled && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Time
                          </label>
                          <input
                            type="time"
                            value={formData.time}
                            onChange={e => setFormData({...formData, time: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-rose-500 dark:bg-white/5 dark:text-white outline-none"
                          />
                        </div>
                      )}
                    </div>

                    {/* Repeat: only when creating, or when editing a whole schedule */}
                    {!formData.id && (
                      <fieldset className="rounded-xl border border-gray-200 dark:border-white/10 p-4 space-y-4">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={repeat.enabled}
                            disabled={!!editingSeriesId}
                            onChange={e => {
                              const enabled = e.target.checked;
                              updateRepeat({
                                enabled,
                                // Start from the time already chosen above.
                                ...(enabled && repeat.times.length === 1 ? { times: [formData.time || '09:00'] } : {}),
                              });
                              // Swap the one-off default reminders for the repeating default.
                              const isDefault = (leads: number[]) => leads.length === 2 && leads.includes(1440) && leads.includes(0);
                              if (enabled && isDefault(reminderLeads)) setReminderLeads([0]);
                              if (!enabled && isReminderEventType(formData.type) && reminderLeads.length === 1 && reminderLeads[0] === 0) {
                                setReminderLeads([1440, 0]);
                              }
                            }}
                            className="h-4 w-4 rounded border-gray-300 dark:border-white/20 accent-rose-500"
                          />
                          Repeat this event
                        </label>

                        {repeat.enabled && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Repeats</label>
                              <select
                                value={repeat.frequency}
                                onChange={e => updateRepeat({ frequency: e.target.value as RecurrenceFrequency })}
                                className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-rose-500 dark:bg-white/5 dark:text-white outline-none"
                              >
                                <option value="daily">Every day</option>
                                <option value="interval">Every few days</option>
                                <option value="weekly">On certain days of the week</option>
                              </select>
                            </div>

                            {repeat.frequency === 'interval' && (
                              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                Every
                                <input
                                  type="number"
                                  min={2}
                                  max={30}
                                  value={repeat.interval}
                                  onChange={e => updateRepeat({ interval: Number(e.target.value) })}
                                  className="w-20 px-2 py-1.5 border border-gray-300 dark:border-white/10 rounded-lg dark:bg-white/5 dark:text-white outline-none"
                                />
                                days
                              </label>
                            )}

                            {repeat.frequency === 'weekly' && (
                              <div className="flex flex-wrap gap-2">
                                {WEEKDAY_LABELS.map((label, day) => {
                                  const on = repeat.weekdays.includes(day);
                                  return (
                                    <button
                                      key={label}
                                      type="button"
                                      aria-pressed={on}
                                      onClick={() => updateRepeat({
                                        weekdays: on ? repeat.weekdays.filter(d => d !== day) : [...repeat.weekdays, day],
                                      })}
                                      className={`px-3 py-1.5 rounded-full text-sm font-medium border cursor-pointer ${
                                        on
                                          ? 'bg-rose-500 border-rose-500 text-white'
                                          : 'border-gray-300 dark:border-white/10 text-gray-700 dark:text-gray-300'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Time{repeat.times.length === 1 ? '' : 's'} each day
                              </label>
                              <div className="space-y-2">
                                {repeat.times.map((time, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <input
                                      type="time"
                                      value={time}
                                      onChange={e => updateRepeat({ times: repeat.times.map((t, j) => (j === i ? e.target.value : t)) })}
                                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-rose-500 dark:bg-white/5 dark:text-white outline-none"
                                    />
                                    {repeat.times.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => updateRepeat({ times: repeat.times.filter((_, j) => j !== i) })}
                                        aria-label="Remove time"
                                        className="p-2 text-gray-500 hover:text-red-500 cursor-pointer"
                                      >
                                        <i className="ri-close-line"></i>
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => updateRepeat({ times: [...repeat.times, '20:00'] })}
                                  className="text-sm font-medium text-rose-500 hover:text-rose-600 cursor-pointer"
                                >
                                  <i className="ri-add-line mr-1"></i>Add another time
                                </button>
                              </div>
                            </div>

                            <div>
                              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ends</span>
                              <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="repeat-end"
                                    checked={repeat.endMode === 'count'}
                                    onChange={() => updateRepeat({ endMode: 'count' })}
                                    className="accent-rose-500"
                                  />
                                  After
                                  <input
                                    type="number"
                                    min={1}
                                    max={366}
                                    value={repeat.count}
                                    onFocus={() => updateRepeat({ endMode: 'count' })}
                                    onChange={e => updateRepeat({ count: Number(e.target.value) })}
                                    className="w-20 px-2 py-1.5 border border-gray-300 dark:border-white/10 rounded-lg dark:bg-white/5 dark:text-white outline-none"
                                  />
                                  days
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="repeat-end"
                                    checked={repeat.endMode === 'date'}
                                    onChange={() => updateRepeat({ endMode: 'date' })}
                                    className="accent-rose-500"
                                  />
                                  On
                                  <input
                                    type="date"
                                    value={repeat.endDate}
                                    min={formData.date}
                                    onFocus={() => updateRepeat({ endMode: 'date' })}
                                    onChange={e => updateRepeat({ endDate: e.target.value })}
                                    className="px-2 py-1.5 border border-gray-300 dark:border-white/10 rounded-lg dark:bg-white/5 dark:text-white outline-none"
                                  />
                                </label>
                              </div>
                            </div>

                            {recurrence && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {plannedStarts.length > 0
                                  ? <>
                                      {describeRecurrence(recurrence)}: <strong>{plannedStarts.length}</strong> event{plannedStarts.length === 1 ? '' : 's'} on the calendar
                                      {editingSeriesId ? ' (only the upcoming ones are replaced)' : ''}.
                                    </>
                                  : recurrenceProblem(recurrence)}
                              </p>
                            )}
                          </>
                        )}
                      </fieldset>
                    )}

                    <div>
                       <MultiUserSelector 
                          value={formData.participants || []} 
                          onChange={val => setFormData({...formData, participants: val})}
                          label="Participants"
                          placeholder="Search and add participants..."
                       />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Event Type
                      </label>
                      <select 
                         value={formData.type}
                         onChange={e => handleTypeChange(e.target.value)}
                         className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-rose-500 dark:bg-white/5 dark:text-white outline-none"
                      >
                        <option value="consultation">Consultation</option>
                        <option value="medical">Medical</option>
                        <option value="legal">Legal</option>
                        <option value="psychological">Psychological</option>
                        <option value="medication">Medication reminder</option>
                        <option value="injection">Injection reminder</option>
                        <option value="reminder">Other reminder / action needed</option>
                      </select>
                    </div>

                    {/* Medicines: new medication / injection events and schedules.
                        An existing one-off event keeps them in its notes. */}
                    {isMedicineType(formData.type) && !formData.id && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Medicines
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          Shown on the user's calendar and at the start of each push reminder.
                        </p>
                        <div className="space-y-2">
                          {medicines.map((medicine, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={medicine.name}
                                onChange={e => updateMedicine(i, { name: e.target.value })}
                                placeholder="Medicine, e.g. Estrace"
                                aria-label={`Medicine ${i + 1} name`}
                                className="flex-[3] min-w-0 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-rose-500 dark:bg-white/5 dark:text-white outline-none"
                              />
                              <input
                                type="text"
                                value={medicine.dose}
                                onChange={e => updateMedicine(i, { dose: e.target.value })}
                                placeholder="Dose, e.g. 2 mg"
                                aria-label={`Medicine ${i + 1} dose`}
                                className="flex-[2] min-w-0 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-rose-500 dark:bg-white/5 dark:text-white outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setMedicines(prev => prev.filter((_, j) => j !== i))}
                                aria-label="Remove medicine"
                                className="p-2 text-gray-500 hover:text-red-500 cursor-pointer"
                              >
                                <i className="ri-close-line"></i>
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setMedicines(prev => [...prev, { name: '', dose: '' }])}
                            className="text-sm font-medium text-rose-500 hover:text-rose-600 cursor-pointer"
                          >
                            <i className="ri-add-line mr-1"></i>Add medicine
                          </button>
                        </div>
                      </div>
                    )}

                    <fieldset>
                      <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Push reminders
                      </legend>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        The user sees this event on their app calendar and gets a push notification at the times you tick.
                      </p>
                      <div className="flex flex-wrap gap-x-5 gap-y-2">
                        {REMINDER_LEAD_OPTIONS.map(option => (
                          <label key={option.minutes} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={reminderLeads.includes(option.minutes)}
                              onChange={() => toggleReminderLead(option.minutes)}
                              className="h-4 w-4 rounded border-gray-300 dark:border-white/20 accent-rose-500"
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Notes
                      </label>
                      <textarea
                        value={formData.notes || ''}
                        onChange={e => setFormData({...formData, notes: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-rose-500 dark:bg-white/5 dark:text-white outline-none resize-none"
                        placeholder="Add any additional notes here..."
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button color="blue" className="flex-1" onClick={handleCreateEvent} disabled={isSaving}>
                        <i className="ri-save-line mr-2"></i>
                        {isSaving
                          ? 'Saving...'
                          : editingSeriesId ? 'Update Schedule'
                          : formData.id ? 'Update Event'
                          : repeat.enabled ? 'Create Schedule'
                          : 'Create Event'}
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={closeEventModal}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <MedicalRecordModal 
            isOpen={showMedicalModal} 
            onClose={() => setShowMedicalModal(false)}
            userId={formData.userId}
          />
        </main>
      </div>
    </div>
  );
};

export default CalendarPage;
