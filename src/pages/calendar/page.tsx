import React, { useState } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';

// Mock calendar data
const calendarEvents = [
  {
    id: 'CAL001',
    title: 'Initial Consultation',
    type: 'consultation',
    date: '2024-01-15',
    time: '10:00 AM',
    duration: 60,
    participants: ['Dr. Sarah Wilson', 'Emma Thompson', 'John & Mary Davis'],
    location: 'Clinic Room 1',
    status: 'confirmed'
  },
  {
    id: 'CAL002',
    title: 'Medical Screening',
    type: 'medical',
    date: '2024-01-16',
    time: '2:00 PM',
    duration: 90,
    participants: ['Dr. Michael Chen', 'Lisa Rodriguez'],
    location: 'Medical Center',
    status: 'pending'
  },
  {
    id: 'CAL003',
    title: 'Legal Review',
    type: 'legal',
    date: '2024-01-17',
    time: '11:00 AM',
    duration: 45,
    participants: ['Attorney Johnson', 'Robert & Susan Miller'],
    location: 'Law Office',
    status: 'confirmed'
  },
  {
    id: 'CAL004',
    title: 'Psychological Evaluation',
    type: 'psychological',
    date: '2024-01-18',
    time: '9:00 AM',
    duration: 120,
    participants: ['Dr. Patricia Lee', 'Amanda Wilson'],
    location: 'Psychology Clinic',
    status: 'completed'
  },
  {
    id: 'CAL005',
    title: 'IVF Transfer',
    type: 'medical',
    date: '2024-01-20',
    time: '8:00 AM',
    duration: 180,
    participants: ['Dr. Michael Chen', 'Emma Thompson'],
    location: 'IVF Center',
    status: 'scheduled'
  }
];

const CalendarPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showNewEventModal, setShowNewEventModal] = useState(false);

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
    const dateStr = `2024-01-${day.toString().padStart(2, '0')}`;
    return calendarEvents.filter(event => event.date === dateStr);
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'consultation':
        return 'bg-blue-500';
      case 'medical':
        return 'bg-green-500';
      case 'legal':
        return 'bg-purple-500';
      case 'psychological':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
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
              className="min-h-[120px] p-2 border-r border-b border-gray-200 dark:border-gray-700 last:border-r-0"
            >
              {day && (
                <>
                  <div className="font-semibold text-gray-900 dark:text-white mb-2">{day}</div>
                  <div className="space-y-1">
                    {getEventsForDate(day).map(event => (
                      <div
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className={`text-xs p-1 rounded cursor-pointer text-white ${getEventTypeColor(event.type)} hover:opacity-80`}
                      >
                        <div className="font-medium truncate">{event.title}</div>
                        <div className="truncate">{event.time}</div>
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
        {calendarEvents.slice(0, 5).map(event => (
          <div
            key={event.id}
            onClick={() => setSelectedEvent(event)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
          >
            <div className={`w-3 h-3 rounded-full ${getEventTypeColor(event.type)}`}></div>
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-white">{event.title}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {event.date} at {event.time}
              </div>
            </div>
            {getStatusBadge(event.status)}
          </div>
        ))}
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
                <Button color="blue" onClick={() => setShowNewEventModal(true)}>
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
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full">
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
                      {getStatusBadge(selectedEvent.status)}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
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
                        <div className="font-medium text-gray-900 dark:text-white">{selectedEvent.duration} min</div>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Location:</span>
                        <div className="font-medium text-gray-900 dark:text-white">{selectedEvent.location}</div>
                      </div>
                    </div>

                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Participants:</span>
                      <div className="mt-1 space-y-1">
                        {selectedEvent.participants.map((participant: string, index: number) => (
                          <div key={index} className="flex items-center gap-2">
                            <i className="ri-user-line text-gray-400"></i>
                            <span className="text-gray-900 dark:text-white text-sm">{participant}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button color="blue" className="flex-1">
                        <i className="ri-edit-line mr-2"></i>
                        Edit
                      </Button>
                      <Button variant="outline" className="flex-1">
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
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">New Event</h2>
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
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Enter event title"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Date
                        </label>
                        <input
                          type="date"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Time
                        </label>
                        <input
                          type="time"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Event Type
                      </label>
                      <select className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
                        <option value="consultation">Consultation</option>
                        <option value="medical">Medical</option>
                        <option value="legal">Legal</option>
                        <option value="psychological">Psychological</option>
                      </select>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button color="blue" className="flex-1">
                        <i className="ri-save-line mr-2"></i>
                        Create Event
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
        </main>
      </div>
    </div>
  );
};

export default CalendarPage;
