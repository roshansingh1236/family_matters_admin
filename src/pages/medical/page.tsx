import React, { useState } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';

// Mock medical records data
const medicalRecords = [
  {
    id: 'MED001',
    patientName: 'Emma Thompson',
    patientType: 'surrogate',
    recordType: 'screening',
    title: 'Initial Medical Screening',
    date: '2024-01-10',
    doctor: 'Dr. Michael Chen',
    facility: 'Reproductive Health Center',
    status: 'completed',
    results: 'All tests normal',
    attachments: ['blood_work.pdf', 'ultrasound.pdf'],
    notes: 'Patient cleared for surrogacy program. All screening tests within normal limits.'
  },
  {
    id: 'MED002',
    patientName: 'Lisa Rodriguez',
    patientType: 'surrogate',
    recordType: 'monitoring',
    title: 'Pregnancy Monitoring - Week 12',
    date: '2024-01-15',
    doctor: 'Dr. Sarah Wilson',
    facility: 'Women\'s Health Clinic',
    status: 'reviewed',
    results: 'Healthy pregnancy progression',
    attachments: ['ultrasound_12w.pdf', 'lab_results.pdf'],
    notes: 'Fetal development on track. Mother and baby healthy.'
  },
  {
    id: 'MED003',
    patientName: 'Jennifer Adams',
    patientType: 'surrogate',
    recordType: 'procedure',
    title: 'Embryo Transfer Procedure',
    date: '2024-01-08',
    doctor: 'Dr. Patricia Lee',
    facility: 'IVF Center',
    status: 'completed',
    results: 'Successful transfer',
    attachments: ['procedure_notes.pdf', 'post_op.pdf'],
    notes: 'Two high-quality embryos transferred successfully. Patient recovering well.'
  },
  {
    id: 'MED004',
    patientName: 'Amanda Wilson',
    patientType: 'surrogate',
    recordType: 'consultation',
    title: 'Psychological Evaluation',
    date: '2024-01-12',
    doctor: 'Dr. Robert Martinez',
    facility: 'Mental Health Associates',
    status: 'pending_review',
    results: 'Assessment complete',
    attachments: ['psych_eval.pdf'],
    notes: 'Comprehensive psychological assessment completed. Awaiting final review.'
  },
  {
    id: 'MED005',
    patientName: 'Rachel Green',
    patientType: 'intended_parent',
    recordType: 'screening',
    title: 'Genetic Screening',
    date: '2024-01-14',
    doctor: 'Dr. Emily Brown',
    facility: 'Genetics Laboratory',
    status: 'in_progress',
    results: 'Pending',
    attachments: ['genetic_consent.pdf'],
    notes: 'Genetic testing in progress. Results expected within 7-10 days.'
  }
];

const recordStats = [
  { label: 'Total Records', value: '248', change: '+15%', icon: 'ri-file-list-3-line', color: 'blue' },
  { label: 'Pending Review', value: '12', change: '-8%', icon: 'ri-time-line', color: 'yellow' },
  { label: 'Completed', value: '198', change: '+22%', icon: 'ri-check-line', color: 'green' },
  { label: 'In Progress', value: '38', change: '+5%', icon: 'ri-loader-line', color: 'purple' }
];

const recordTypes = [
  { id: 'all', label: 'All Records', count: medicalRecords.length },
  { id: 'screening', label: 'Screening', count: medicalRecords.filter(r => r.recordType === 'screening').length },
  { id: 'monitoring', label: 'Monitoring', count: medicalRecords.filter(r => r.recordType === 'monitoring').length },
  { id: 'procedure', label: 'Procedures', count: medicalRecords.filter(r => r.recordType === 'procedure').length },
  { id: 'consultation', label: 'Consultations', count: medicalRecords.filter(r => r.recordType === 'consultation').length }
];

const MedicalPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [showNewRecordModal, setShowNewRecordModal] = useState(false);

  const filteredRecords = activeTab === 'all' 
    ? medicalRecords 
    : medicalRecords.filter(record => record.recordType === activeTab);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge color="green">Completed</Badge>;
      case 'pending_review':
        return <Badge color="yellow">Pending Review</Badge>;
      case 'in_progress':
        return <Badge color="blue">In Progress</Badge>;
      case 'reviewed':
        return <Badge color="gray">Reviewed</Badge>;
      case 'cancelled':
        return <Badge color="red">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getRecordTypeIcon = (type: string) => {
    switch (type) {
      case 'screening':
        return 'ri-search-line';
      case 'monitoring':
        return 'ri-heart-pulse-line';
      case 'procedure':
        return 'ri-surgical-mask-line';
      case 'consultation':
        return 'ri-discuss-line';
      default:
        return 'ri-file-text-line';
    }
  };

  const getRecordTypeColor = (type: string) => {
    switch (type) {
      case 'screening':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400';
      case 'monitoring':
        return 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400';
      case 'procedure':
        return 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400';
      case 'consultation':
        return 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
    }
  };

  const getPatientTypeIcon = (type: string) => {
    return type === 'surrogate' ? 'ri-user-heart-line' : 'ri-parent-line';
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
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Medical Records</h1>
                <p className="text-gray-600 dark:text-gray-400">Manage medical documentation and health records.</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline">
                  <i className="ri-download-line mr-2"></i>
                  Export Records
                </Button>
                <Button color="blue" onClick={() => setShowNewRecordModal(true)}>
                  <i className="ri-add-line mr-2"></i>
                  New Record
                </Button>
              </div>
            </div>
          </div>

          {/* Medical Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {recordStats.map((stat, index) => (
              <Card key={index}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                    <p className={`text-sm ${stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                      {stat.change} from last month
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-${stat.color}-100 dark:bg-${stat.color}-900`}>
                    <i className={`${stat.icon} text-xl text-${stat.color}-600 dark:text-${stat.color}-400`}></i>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Record Type Tabs */}
          <div className="mb-6">
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
              {recordTypes.map((type) => (
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

          {/* Medical Records List */}
          <div className="space-y-4">
            {filteredRecords.map((record) => (
              <Card key={record.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedRecord(record)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getRecordTypeColor(record.recordType)}`}>
                      <i className={`${getRecordTypeIcon(record.recordType)} text-lg`}></i>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{record.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <i className={`${getPatientTypeIcon(record.patientType)} text-xs`}></i>
                        <span>{record.patientName}</span>
                        <span>•</span>
                        <span>{record.date}</span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Dr. {record.doctor} • {record.facility}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(record.status)}
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {record.attachments.length} attachment{record.attachments.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Medical Record Detail Modal */}
          {selectedRecord && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Medical Record Details</h2>
                    <button
                      onClick={() => setSelectedRecord(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                    >
                      <i className="ri-close-line text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${getRecordTypeColor(selectedRecord.recordType)}`}>
                        <i className={`${getRecordTypeIcon(selectedRecord.recordType)} text-2xl`}></i>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedRecord.title}</h3>
                        <p className="text-gray-600 dark:text-gray-400">Record ID: {selectedRecord.id}</p>
                        {getStatusBadge(selectedRecord.status)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Patient Information</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Name:</span>
                            <span className="text-gray-900 dark:text-white">{selectedRecord.patientName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Type:</span>
                            <span className="text-gray-900 dark:text-white capitalize">
                              {selectedRecord.patientType.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Record Type:</span>
                            <span className="text-gray-900 dark:text-white capitalize">{selectedRecord.recordType}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Medical Details</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Date:</span>
                            <span className="text-gray-900 dark:text-white">{selectedRecord.date}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Doctor:</span>
                            <span className="text-gray-900 dark:text-white">{selectedRecord.doctor}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Facility:</span>
                            <span className="text-gray-900 dark:text-white">{selectedRecord.facility}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Results & Notes</h4>
                      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg space-y-3">
                        <div>
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Results:</span>
                          <p className="text-gray-900 dark:text-white">{selectedRecord.results}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Notes:</span>
                          <p className="text-gray-900 dark:text-white">{selectedRecord.notes}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Attachments</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedRecord.attachments.map((attachment: string, index: number) => (
                          <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <i className="ri-file-pdf-line text-red-500 text-xl"></i>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{attachment}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">PDF Document</p>
                            </div>
                            <Button variant="outline" className="text-xs">
                              <i className="ri-download-line mr-1"></i>
                              Download
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button color="blue" className="flex-1">
                        <i className="ri-edit-line mr-2"></i>
                        Edit Record
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <i className="ri-share-line mr-2"></i>
                        Share Record
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <i className="ri-printer-line mr-2"></i>
                        Print
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* New Record Modal */}
          {showNewRecordModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">New Medical Record</h2>
                    <button
                      onClick={() => setShowNewRecordModal(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                    >
                      <i className="ri-close-line text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Patient Name
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Enter patient name"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Patient Type
                        </label>
                        <select className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
                          <option value="surrogate">Surrogate</option>
                          <option value="intended_parent">Intended Parent</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Record Type
                        </label>
                        <select className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
                          <option value="screening">Screening</option>
                          <option value="monitoring">Monitoring</option>
                          <option value="procedure">Procedure</option>
                          <option value="consultation">Consultation</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Title
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Record title"
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
                          Doctor
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="Doctor name"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Notes
                      </label>
                      <textarea
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Medical notes and observations"
                      ></textarea>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button color="blue" className="flex-1">
                        <i className="ri-save-line mr-2"></i>
                        Create Record
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => setShowNewRecordModal(false)}>
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

export default MedicalPage;
