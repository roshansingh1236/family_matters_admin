
import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { appointmentService } from '../../services/appointmentService';
import type { Appointment } from '../../services/appointmentService';
import UserSelector from '../../components/feature/UserSelector';
import MultiUserSelector from '../../components/feature/MultiUserSelector';
import MedicalRecordModal from '../../components/feature/MedicalRecordModal';
import { supabase } from '../../lib/supabase';

const CalendarPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [selectedEvent, setSelectedEvent] = useState<Appointment | null>(null);
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [events, setEvents] = useState<Appointment[]>([]);
  const [showMedicalModal, setShowMedicalModal] = useState(false);
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});

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

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const getEventsForDate = (day: number) => {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;
    return events.filter(event => event.date === dateStr);
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'consultation': return 'bg-blue-500';
      case 'medical': return 'bg-green-500';
      case 'legal': return 'bg-purple-500';
      case 'psychological': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

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

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const handleCreateEvent = async () => {
    try {
        if (formData.id) {
            await appointmentService.updateAppointment(formData.id, formData as any);
        } else {
            await appointmentService.createAppointment(formData as any);
        }
        await fetchEvents();
        setShowNewEventModal(false);
        setFormData({
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
    } catch (error) {
        console.error("Failed to save event", error);
    }
  };

  const handleEditEvent = () => {
    if (selectedEvent) {
        setFormData({
            ...selectedEvent,
            // Ensure date and time are strings for input fields
            date: selectedEvent.date,
            time: selectedEvent.time
        });
        setShowNewEventModal(true);
        setSelectedEvent(null);
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

  const renderMonthView = () => {
    const days = getDaysInMonth(currentDate);
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {/* Calendar Header */}
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {daysOfWeek.map(day => (
            <div key={day} className="p-4 text-center font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => (
            <div
              key={index}
              className="min-h-[120px] p-2 border-r border-b border-gray-200 dark:border-gray-700 last:border-r-0 relative hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              {day && (
                <>
                  <div className={`font-semibold mb-2 ${
                      day === new Date().getDate() && 
                      currentDate.getMonth() === new Date().getMonth() && 
                      currentDate.getFullYear() === new Date().getFullYear() 
                      ? 'bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center' 
                      : 'text-gray-900 dark:text-white'
                  }`}>{day}</div>
                  <div className="space-y-1">
                    {getEventsForDate(day).map(event => (
                      <div
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className={`text-xs p-1 rounded cursor-pointer text-white ${getEventTypeColor(event.type)} hover:opacity-80 shadow-sm truncate`}
                      >
                        <span className="font-bold mr-1">{event.time}</span>
                        {event.title}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderUpcomingEvents = () => (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Upcoming Events</h3>
      <div className="space-y-3">
        {events.slice(0, 5).map(event => (
          <div
            key={event.id}
            onClick={() => setSelectedEvent(event)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
          >
            <div className={`w-3 h-3 rounded-full ${getEventTypeColor(event.type)}`}></div>
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-white line-clamp-1">{event.title}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {event.date} at {event.time}
              </div>
            </div>
            {getStatusBadge(event.status)}
          </div>
        ))}
        {events.length === 0 && (
            <p className="text-gray-500 text-center py-4">No upcoming events</p>
        )}
      </div>
    </Card>
  );

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Calendar</h1>
                <p className="text-gray-600 dark:text-gray-400">Manage appointments and schedule events.</p>
              </div>
              <div className="flex gap-3">
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  {(['month', 'week', 'day'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer capitalize ${
                        viewMode === mode
                          ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <Button color="blue" onClick={() => {
                  setFormData({
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
                  setShowNewEventModal(true);
                }}>
                  <i className="ri-add-line mr-2"></i>
                  New Event
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Calendar */}
            <div className="lg:col-span-3">
              <Card>
                {/* Calendar Navigation */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigateMonth('prev')}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                    >
                      <i className="ri-arrow-left-line text-gray-600 dark:text-gray-400"></i>
                    </button>
                    <button
                      onClick={() => setCurrentDate(new Date())}
                      className="px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg cursor-pointer"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => navigateMonth('next')}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                    >
                      <i className="ri-arrow-right-line text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>
                </div>

                {viewMode === 'month' && renderMonthView()}
                
                {viewMode === 'week' && (
                  <div className="text-center py-12">
                    <i className="ri-calendar-line text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Week View</h3>
                    <p className="text-gray-600 dark:text-gray-400">Week view coming soon</p>
                  </div>
                )}
                
                {viewMode === 'day' && (
                  <div className="text-center py-12">
                    <i className="ri-calendar-line text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Day View</h3>
                    <p className="text-gray-600 dark:text-gray-400">Day view coming soon</p>
                  </div>
                )}
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {renderUpcomingEvents()}
              
              <Card>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Event Types</h3>
                <div className="space-y-2">
                  {[
                    { type: 'consultation', label: 'Consultations', color: 'bg-blue-500' },
                    { type: 'medical', label: 'Medical', color: 'bg-green-500' },
                    { type: 'legal', label: 'Legal', color: 'bg-purple-500' },
                    { type: 'psychological', label: 'Psychological', color: 'bg-orange-500' }
                  ].map(item => (
                    <div key={item.type} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* Event Detail Modal */}
          {selectedEvent && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full shadow-2xl">
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
                    
                    <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Date:</span>
                        <div className="font-medium text-gray-900 dark:text-white">{selectedEvent.date}</div>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Time:</span>
                        <div className="font-medium text-gray-900 dark:text-white">{selectedEvent.time}</div>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                        <div className="font-medium text-gray-900 dark:text-white">{selectedEvent.duration}</div>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Location:</span>
                        <div className="font-medium text-gray-900 dark:text-white">{selectedEvent.location}</div>
                      </div>
                    </div>

                    <div>
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Participants:</span>
                      <div className="mt-2 flex flex-wrap gap-2 text-sm">
                        {(selectedEvent.participants && Array.isArray(selectedEvent.participants) && selectedEvent.participants.length > 0) ? selectedEvent.participants.map((participantId, index) => (
                          <div key={index} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full border border-blue-100 dark:border-blue-800 shadow-sm">
                            <i className="ri-user-line text-xs"></i>
                            <span className="font-medium">{participantNames[participantId] || 'Loading...'}</span>
                          </div>
                        )) : (
                            <span className="text-gray-500 italic text-sm">No participants</span>
                        )}
                      </div>
                    </div>

                    {selectedEvent.notes && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400 font-medium">Notes:</span>
                        <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600">
                          {selectedEvent.notes}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-4">
                      <Button color="blue" className="flex-1" onClick={handleEditEvent}>
                        <i className="ri-edit-line mr-2"></i>
                        Edit
                      </Button>
                      <Button variant="outline" className="flex-1" color="red" onClick={() => selectedEvent.id && handleDeleteEvent(selectedEvent.id)}>
                        <i className="ri-delete-bin-line mr-2"></i>
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* New Event Modal */}
          {showNewEventModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full shadow-2xl">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {formData.id ? 'Edit Event' : 'New Event'}
                    </h2>
                    <button
                      onClick={() => setShowNewEventModal(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                    >
                      <i className="ri-close-line text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Event Title
                      </label>
                      <input
                        type="text"
                        value={formData.title || ''}
                        onChange={e => setFormData({...formData, title: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white outline-none"
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
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Date
                        </label>
                        <input
                          type="date"
                          value={formData.date}
                          onChange={e => setFormData({...formData, date: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Time
                        </label>
                        <input
                          type="time"
                          value={formData.time}
                          onChange={e => setFormData({...formData, time: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white outline-none"
                        />
                      </div>
                    </div>

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
                         onChange={e => setFormData({...formData, type: e.target.value as any})}
                         className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white outline-none"
                      >
                        <option value="consultation">Consultation</option>
                        <option value="medical">Medical</option>
                        <option value="legal">Legal</option>
                        <option value="psychological">Psychological</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Notes
                      </label>
                      <textarea
                        value={formData.notes || ''}
                        onChange={e => setFormData({...formData, notes: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white outline-none resize-none"
                        placeholder="Add any additional notes here..."
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button color="blue" className="flex-1" onClick={handleCreateEvent}>
                        <i className="ri-save-line mr-2"></i>
                        {formData.id ? 'Update Event' : 'Create Event'}
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => setShowNewEventModal(false)}>
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
