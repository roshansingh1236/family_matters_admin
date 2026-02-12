
import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { appointmentService, Appointment } from '../../services/appointmentService';

// Define appointment types
const appointmentTypes = [
  { id: 'all', label: 'All Appointments' },
  { id: 'consultation', label: 'Consultations' },
  { id: 'medical', label: 'Medical' },
  { id: 'legal', label: 'Legal' },
  { id: 'psychological', label: 'Psychological' }
];

const AppointmentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Appointment>>({
    title: '',
    type: 'consultation',
    date: '',
    time: '',
    duration: '',
    participants: [],
    location: '',
    status: 'scheduled',
    notes: ''
  });
  const [participantsInput, setParticipantsInput] = useState('');

  const fetchAppointments = async () => {
    setIsLoading(true);
    try {
      const data = await appointmentService.getAllAppointments();
      // Ensure data is an array
      setAppointments(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load appointments');
      setAppointments([]); // Safe fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const filteredAppointments = useMemo(() => {
     if (!Array.isArray(appointments)) return [];
     return activeTab === 'all' 
        ? appointments 
        : appointments.filter(appointment => appointment.type === activeTab);
  }, [appointments, activeTab]);

  const getStatusBadge = (status: string) => {
    const s = status ? status.toLowerCase() : 'unknown';
    switch (s) {
      case 'confirmed':
        return <Badge color="green">Confirmed</Badge>;
      case 'pending':
        return <Badge color="yellow">Pending</Badge>;
      case 'scheduled':
        return <Badge color="blue">Scheduled</Badge>;
      case 'completed':
        return <Badge color="gray">Completed</Badge>;
      case 'cancelled':
        return <Badge color="red">Cancelled</Badge>;
      default:
        return <Badge>{status || 'Unknown'}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    const t = type ? type.toLowerCase() : 'other';
    switch (t) {
      case 'consultation': return 'ri-discuss-line';
      case 'medical': return 'ri-health-book-line';
      case 'legal': return 'ri-file-text-line';
      case 'psychological': return 'ri-mind-map';
      default: return 'ri-calendar-line';
    }
  };

  const getTypeColor = (type: string) => {
    const t = type ? type.toLowerCase() : 'other';
     switch (t) {
      case 'consultation': return 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400';
      case 'medical': return 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400';
      case 'legal': return 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400';
      case 'psychological': return 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
    }
  };
  
  // Calendar Helpers
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

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
        days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
        days.push(day);
    }
    return days;
  };

  const handleOpenNewModal = () => {
    setIsEditing(false);
    setFormData({
      title: '',
      type: 'consultation',
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      duration: '60 min',
      participants: [],
      location: '',
      status: 'scheduled',
      notes: ''
    });
    setParticipantsInput('');
    setShowModal(true);
  };

  const handleOpenEditModal = (appointment: Appointment) => {
    setIsEditing(true);
    setFormData(appointment);
    setParticipantsInput(Array.isArray(appointment.participants) ? appointment.participants.join(', ') : '');
    setShowModal(true);
    setSelectedAppointment(null); // Close detail modal if open
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const participants = participantsInput.split(',').map(p => p.trim()).filter(p => p);
      const appointmentData = { ...formData, participants } as Appointment;

      if (isEditing && appointmentData.id) {
        await appointmentService.updateAppointment(appointmentData.id, appointmentData);
      } else {
        await appointmentService.createAppointment(appointmentData);
      }
      
      await fetchAppointments();
      setShowModal(false);
    } catch (err) {
      console.error(err);
      setError('Failed to save appointment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this appointment?')) return;
    setIsLoading(true);
    try {
      await appointmentService.deleteAppointment(id);
      await fetchAppointments();
      setSelectedAppointment(null);
    } catch (err) {
      setError('Failed to delete appointment');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Safe helper for participant count
  const getParticipantCount = (appt: Appointment) => {
      return Array.isArray(appt.participants) ? appt.participants.length : 0;
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Appointments</h1>
                <p className="text-gray-600 dark:text-gray-400">Manage all appointments and scheduling.</p>
              </div>
              <div className="flex gap-3">
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                      viewMode === 'list'
                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <i className="ri-list-unordered mr-1"></i>
                    List
                  </button>
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                      viewMode === 'calendar'
                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <i className="ri-calendar-line mr-1"></i>
                    Calendar
                  </button>
                </div>
                <Button color="blue" onClick={handleOpenNewModal}>
                  <i className="ri-add-line mr-2"></i>
                  New Appointment
                </Button>
              </div>
            </div>
          </div>

          {/* Type Tabs - Only show in List view for now, or both */}
          <div className="mb-6">
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
              {appointmentTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setActiveTab(type.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === type.id
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {type.label} ({
                    type.id === 'all' 
                      ? appointments.length 
                      : appointments.filter(a => a.type === type.id).length
                  })
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          {isLoading && !showModal ? (
             <div className="flex items-center justify-center h-64">
                <i className="ri-loader-4-line text-4xl animate-spin text-blue-600"></i>
             </div>
          ) : viewMode === 'list' ? (
            /* List View */
            <div className="space-y-4">
              {filteredAppointments.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                    <i className="ri-calendar-event-line text-4xl text-gray-400 mb-2"></i>
                    <p className="text-gray-500 dark:text-gray-400">No appointments found.</p>
                </div>
              ) : (
                filteredAppointments.map((appointment) => (
                    <Card key={appointment.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedAppointment(appointment)}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getTypeColor(appointment.type)}`}>
                            <i className={`${getTypeIcon(appointment.type)} text-lg`}></i>
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">{appointment.title}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                            {appointment.date} at {appointment.time} • {appointment.duration}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{appointment.location}</p>
                        </div>
                        </div>
                        <div className="text-right">
                        {getStatusBadge(appointment.status)}
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {getParticipantCount(appointment)} participants
                        </p>
                        </div>
                    </div>
                    </Card>
                ))
              )}
            </div>
          ) : (
            /* Calendar View */
            <Card>
              <div className="p-4">
                {/* Calendar Navigation */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                    {currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                      onClick={() => navigateMonth('prev')}
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
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                      onClick={() => navigateMonth('next')}
                    >
                      <i className="ri-arrow-right-line text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>
                </div>

                {/* Calendar Grid Header */}
                <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="p-4 text-center font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 last:border-r-0">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid Body */}
                <div className="grid grid-cols-7">
                  {(() => {
                    const days = getDaysInMonth(currentDate);
                    
                    return days.map((day, index) => {
                      if (!day) return <div key={`empty-${index}`} className="min-h-[120px] p-2 border-r border-b border-gray-200 dark:border-gray-700 last:border-r-0 bg-gray-50/50 dark:bg-gray-800/50"></div>;
                      
                      const monthStr = String(currentDate.getMonth() + 1).padStart(2, '0');
                      const dayStr = String(day).padStart(2, '0');
                      const dateStr = `${currentDate.getFullYear()}-${monthStr}-${dayStr}`;
                      
                      const dayAppointments = appointments.filter(a => a.date === dateStr);
                      const isToday = 
                          day === new Date().getDate() && 
                          currentDate.getMonth() === new Date().getMonth() &&
                          currentDate.getFullYear() === new Date().getFullYear();

                      return (
                        <div key={day} className="min-h-[120px] p-2 border-r border-b border-gray-200 dark:border-gray-700 last:border-r-0 relative hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <div className={`font-semibold mb-2 w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-gray-900 dark:text-white'}`}>
                            {day}
                          </div>
                          <div className="space-y-1">
                            {dayAppointments.map(appt => {
                                // Determine styling based on type
                                let bgClass = "bg-gray-500";
                                const type = appt.type ? appt.type.toLowerCase() : '';
                                if (type === 'consultation') bgClass = "bg-blue-500";
                                else if (type === 'medical') bgClass = "bg-green-500";
                                else if (type === 'legal') bgClass = "bg-purple-500";
                                else if (type === 'psychological') bgClass = "bg-orange-500";
                                
                                return (
                                  <div 
                                    key={appt.id} 
                                    onClick={() => setSelectedAppointment(appt)}
                                    className={`text-xs p-1 rounded cursor-pointer text-white truncate ${bgClass} hover:opacity-80 shadow-sm`}
                                    title={`${appt.time} - ${appt.title}`}
                                  >
                                    <span className="font-bold mr-1">{appt.time}</span>
                                    {appt.title}
                                  </div>
                                );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </Card>
          )}

          {/* Appointment Detail Modal */}
          {selectedAppointment && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Appointment Details</h2>
                    <button
                      onClick={() => setSelectedAppointment(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
                    >
                      <i className="ri-close-line text-xl text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${getTypeColor(selectedAppointment.type)}`}>
                        <i className={`${getTypeIcon(selectedAppointment.type)} text-3xl`}></i>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedAppointment.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1">ID: {selectedAppointment.id}</p>
                        <div className="mt-2">{getStatusBadge(selectedAppointment.status)}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl">
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <i className="ri-time-line text-blue-500"></i> Schedule
                        </h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400">Date:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{selectedAppointment.date}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400">Time:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{selectedAppointment.time}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400">Duration:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{selectedAppointment.duration}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400">Location:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{selectedAppointment.location}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                             <i className="ri-group-line text-purple-500"></i> Participants
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {(selectedAppointment.participants && Array.isArray(selectedAppointment.participants) && selectedAppointment.participants.length > 0) ? selectedAppointment.participants.map((participant, index) => (
                            <div key={index} className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-600 shadow-sm">
                              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500"></div>
                              <span className="text-gray-700 dark:text-gray-200 text-sm">{participant}</span>
                            </div>
                          )) : (
                              <span className="text-gray-500 text-sm italic">No participants listed</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {selectedAppointment.notes && (
                        <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Notes</h4>
                        <p className="text-gray-600 dark:text-gray-300 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30 p-4 rounded-xl text-sm leading-relaxed">
                            {selectedAppointment.notes}
                        </p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Button color="blue" className="flex-1" onClick={() => handleOpenEditModal(selectedAppointment)}>
                        <i className="ri-edit-line mr-2"></i>
                        Edit
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <i className="ri-calendar-line mr-2"></i>
                        Reschedule
                      </Button>
                      <Button color="red" variant="outline" className="flex-1" onClick={() => selectedAppointment.id && handleDelete(selectedAppointment.id)}>
                        <i className="ri-delete-bin-line mr-2"></i>
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create/Edit Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                 <form onSubmit={handleSubmit} className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {isEditing ? 'Edit Appointment' : 'New Appointment'}
                        </h2>
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
                        >
                            <i className="ri-close-line text-xl text-gray-600 dark:text-gray-400"></i>
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                            <input 
                                type="text" 
                                required
                                value={formData.title} 
                                onChange={e => setFormData({...formData, title: e.target.value})}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="e.g. Initial Consultation"
                            />
                        </div>

                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                                <input 
                                    type="date"
                                    required 
                                    value={formData.date} 
                                    onChange={e => setFormData({...formData, date: e.target.value})}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time</label>
                                <input 
                                    type="time" 
                                    required
                                    value={formData.time} 
                                    onChange={e => setFormData({...formData, time: e.target.value})}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                         </div>

                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration</label>
                                <input 
                                    type="text" 
                                    value={formData.duration} 
                                    onChange={e => setFormData({...formData, duration: e.target.value})}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. 60 min"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                                <select 
                                    value={formData.type}
                                    onChange={e => setFormData({...formData, type: e.target.value as any})}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    {appointmentTypes.filter(t => t.id !== 'all').map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                </select>
                            </div>
                         </div>

                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                            <input 
                                type="text"
                                value={formData.location} 
                                onChange={e => setFormData({...formData, location: e.target.value})}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="e.g. Clinic Room 1"
                            />
                        </div>

                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Participants (comma separated)</label>
                            <input 
                                type="text" 
                                value={participantsInput} 
                                onChange={e => setParticipantsInput(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="e.g. John Doe, Jane Doe"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                            <select 
                                value={formData.status}
                                onChange={e => setFormData({...formData, status: e.target.value as any})}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="scheduled">Scheduled</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="pending">Pending</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                            <textarea
                                value={formData.notes || ''}
                                onChange={e => setFormData({...formData, notes: e.target.value})}
                                rows={3}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                placeholder="Add any detailed notes..."
                            ></textarea>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                        <Button type="submit" color="blue" className="flex-1" disabled={isLoading}>
                            {isLoading ? 'Saving...' : 'Save Appointment'}
                        </Button>
                    </div>
                 </form>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default AppointmentsPage;
