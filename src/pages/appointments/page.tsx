import React, { useState } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';

// Mock data for appointments
const appointments = [
  {
    id: 'APT001',
    title: 'Initial Consultation',
    type: 'consultation',
    date: '2024-01-15',
    time: '10:00 AM',
    duration: '60 min',
    participants: ['Dr. Sarah Wilson', 'Emma Thompson', 'John & Mary Davis'],
    location: 'Clinic Room 1',
    status: 'confirmed',
    notes: 'First meeting between intended parents and surrogate'
  },
  {
    id: 'APT002',
    title: 'Medical Screening',
    type: 'medical',
    date: '2024-01-16',
    time: '2:00 PM',
    duration: '90 min',
    participants: ['Dr. Michael Chen', 'Lisa Rodriguez'],
    location: 'Medical Center',
    status: 'pending',
    notes: 'Comprehensive medical evaluation'
  },
  {
    id: 'APT003',
    title: 'Legal Review Meeting',
    type: 'legal',
    date: '2024-01-17',
    time: '11:00 AM',
    duration: '45 min',
    participants: ['Attorney Johnson', 'Robert & Susan Miller', 'Jennifer Adams'],
    location: 'Law Office',
    status: 'confirmed',
    notes: 'Contract review and legal procedures'
  },
  {
    id: 'APT004',
    title: 'Psychological Evaluation',
    type: 'psychological',
    date: '2024-01-18',
    time: '9:00 AM',
    duration: '120 min',
    participants: ['Dr. Patricia Lee', 'Amanda Wilson'],
    location: 'Psychology Clinic',
    status: 'completed',
    notes: 'Mental health assessment completed'
  },
  {
    id: 'APT005',
    title: 'IVF Transfer Procedure',
    type: 'medical',
    date: '2024-01-20',
    time: '8:00 AM',
    duration: '180 min',
    participants: ['Dr. Michael Chen', 'Emma Thompson', 'John & Mary Davis'],
    location: 'IVF Center',
    status: 'scheduled',
    notes: 'Embryo transfer procedure'
  }
];

const appointmentTypes = [
  { id: 'all', label: 'All Appointments', count: appointments.length },
  { id: 'consultation', label: 'Consultations', count: appointments.filter(a => a.type === 'consultation').length },
  { id: 'medical', label: 'Medical', count: appointments.filter(a => a.type === 'medical').length },
  { id: 'legal', label: 'Legal', count: appointments.filter(a => a.type === 'legal').length },
  { id: 'psychological', label: 'Psychological', count: appointments.filter(a => a.type === 'psychological').length }
];

const AppointmentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  const filteredAppointments = activeTab === 'all' 
    ? appointments 
    : appointments.filter(appointment => appointment.type === activeTab);

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
      case 'cancelled':
        return <Badge color="red">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'consultation':
        return 'ri-discuss-line';
      case 'medical':
        return 'ri-health-book-line';
      case 'legal':
        return 'ri-file-text-line';
      case 'psychological':
        return 'ri-mind-map';
      default:
        return 'ri-calendar-line';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'consultation':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400';
      case 'medical':
        return 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400';
      case 'legal':
        return 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400';
      case 'psychological':
        return 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
    }
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
                <Button color="blue">
                  <i className="ri-add-line mr-2"></i>
                  New Appointment
                </Button>
              </div>
            </div>
          </div>

          {/* Type Tabs */}
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
                  {type.label} ({type.count})
                </button>
              ))}
            </div>
          </div>

          {viewMode === 'list' ? (
            /* List View */
            <div className="space-y-4">
              {filteredAppointments.map((appointment) => (
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
                        {appointment.participants.length} participants
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            /* Calendar View */
            <Card>
              <div className="p-6">
                <div className="text-center py-12">
                  <i className="ri-calendar-line text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Calendar View</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Calendar integration coming soon. View appointments in a monthly calendar format.
                  </p>
                  <Button onClick={() => setViewMode('list')}>
                    <i className="ri-list-unordered mr-2"></i>
                    Switch to List View
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Appointment Detail Modal */}
          {selectedAppointment && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Appointment Details</h2>
                    <button
                      onClick={() => setSelectedAppointment(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                    >
                      <i className="ri-close-line text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${getTypeColor(selectedAppointment.type)}`}>
                        <i className={`${getTypeIcon(selectedAppointment.type)} text-2xl`}></i>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedAppointment.title}</h3>
                        <p className="text-gray-600 dark:text-gray-400">Appointment ID: {selectedAppointment.id}</p>
                        {getStatusBadge(selectedAppointment.status)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Schedule Details</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Date:</span>
                            <span className="text-gray-900 dark:text-white">{selectedAppointment.date}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Time:</span>
                            <span className="text-gray-900 dark:text-white">{selectedAppointment.time}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                            <span className="text-gray-900 dark:text-white">{selectedAppointment.duration}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Location:</span>
                            <span className="text-gray-900 dark:text-white">{selectedAppointment.location}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Participants</h4>
                        <div className="space-y-2">
                          {selectedAppointment.participants.map((participant: string, index: number) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                <i className="ri-user-line text-blue-600 dark:text-blue-400 text-xs"></i>
                              </div>
                              <span className="text-gray-900 dark:text-white text-sm">{participant}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Notes</h4>
                      <p className="text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                        {selectedAppointment.notes}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <Button color="blue" className="flex-1">
                        <i className="ri-edit-line mr-2"></i>
                        Edit Appointment
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <i className="ri-calendar-line mr-2"></i>
                        Reschedule
                      </Button>
                      <Button color="red" variant="outline" className="flex-1">
                        <i className="ri-close-line mr-2"></i>
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

export default AppointmentsPage;
