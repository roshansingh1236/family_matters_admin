
import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { medicalService } from '../../services/medicalService';
import type { MedicalRecord, Medication } from '../../services/medicalService';
import MedicalRecordModal from '../../components/feature/MedicalRecordModal';

const MedicalPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'records' | 'medications'>('records');
  const [isLoading, setIsLoading] = useState(true);
  
  // Records State
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [recordForm, setRecordForm] = useState<Partial<MedicalRecord>>({
    title: '', type: 'Screening', date: '', doctor: '', facility: '', summary: '', status: 'Pending', sharedWithParents: false
  });

  // Medications State
  const [medications, setMedications] = useState<Medication[]>([]);
  const [showMedModal, setShowMedModal] = useState(false);
  const [medForm, setMedForm] = useState<Partial<Medication>>({
    name: '', dosage: '', frequency: '', startDate: '', status: 'Active'
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [fetchedRecords, fetchedMeds] = await Promise.all([
        medicalService.getAllRecords(),
        medicalService.getAllMedications()
      ]);
      setRecords(fetchedRecords);
      setMedications(fetchedMeds);
    } catch (error) {
      console.error("Error loading medical data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Handlers for Records ---
  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (recordForm.id) {
         await medicalService.updateRecord(recordForm.id, recordForm);
      } else {
         await medicalService.createRecord(recordForm as any);
      }
      await fetchData();
      setShowRecordModal(false);
      setRecordForm({ title: '', type: 'Screening', date: '', doctor: '', facility: '', summary: '', status: 'Pending', sharedWithParents: false });
    } catch (error) {
      console.error(error);
    }
  };
  
  const handleDeleteRecord = async (id: string) => {
      if(!confirm("Delete this record?")) return;
      await medicalService.deleteRecord(id);
      await fetchData();
      setSelectedRecord(null);
  };

  // --- Handlers for Medications ---
  const handleSaveMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        if (medForm.id) {
            await medicalService.updateMedication(medForm.id, medForm);
        } else {
            await medicalService.addMedication(medForm as any);
        }
        await fetchData();
        setShowMedModal(false);
        setMedForm({ name: '', dosage: '', frequency: '', startDate: '', status: 'Active' });
    } catch (error) {
        console.error(error);
    }
  };

   const handleDeleteMedication = async (id: string) => {
      if(!confirm("Delete this medication?")) return;
      await medicalService.deleteMedication(id);
      await fetchData();
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Verified': return <Badge color="green">Verified</Badge>;
      case 'Review Required': return <Badge color="yellow">Review Required</Badge>;
      case 'Active': return <Badge color="green">Active</Badge>;
      case 'Completed': return <Badge color="gray">Completed</Badge>;
      case 'Discontinued': return <Badge color="red">Discontinued</Badge>;
      default: return <Badge color="gray">{status}</Badge>;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Medical</h1>
              <p className="text-gray-600 dark:text-gray-400">Manage health records and medications.</p>
            </div>
            <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                <button 
                    onClick={() => setActiveTab('records')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'records' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600' : 'text-gray-600'}`}
                >
                    Records
                </button>
                <button 
                     onClick={() => setActiveTab('medications')}
                     className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'medications' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600' : 'text-gray-600'}`}
                >
                    Medications
                </button>
            </div>
          </div>

          {!isLoading && activeTab === 'records' && (
            <>
               <div className="flex justify-end mb-4">
                  <Button color="blue" onClick={() => { setRecordForm({}); setShowRecordModal(true); }}>
                      <i className="ri-add-line mr-2"></i> New Record
                  </Button>
               </div>
               
               <div className="space-y-4">
                  {records.map(record => (
                      <Card key={record.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedRecord(record)}>
                          <div className="flex justify-between items-start">
                              <div className="flex gap-4">
                                  <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                      <i className="ri-file-list-3-line text-xl"></i>
                                  </div>
                                  <div>
                                      <h3 className="font-semibold text-gray-900 dark:text-white">{record.title}</h3>
                                      <p className="text-sm text-gray-500">{record.type} • {record.date}</p>
                                      <p className="text-sm text-gray-500 mt-1">Dr. {record.doctor} @ {record.facility}</p>
                                  </div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                  {getStatusBadge(record.status)}
                                  {record.sharedWithParents && (
                                     <span className="text-xs flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                         <i className="ri-eye-line"></i> Shared
                                     </span>
                                  )}
                              </div>
                          </div>
                      </Card>
                  ))}
                  {records.length === 0 && <p className="text-center text-gray-500 py-8">No medical records found.</p>}
               </div>
            </>
          )}

          {!isLoading && activeTab === 'medications' && (
             <>
                <div className="flex justify-end mb-4">
                   <Button color="blue" onClick={() => { setMedForm({}); setShowMedModal(true); }}>
                       <i className="ri-add-line mr-2"></i> Add Medication
                   </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {medications.map(med => (
                        <Card key={med.id}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-600">
                                    <i className="ri-capsule-line text-lg"></i>
                                </div>
                                {getStatusBadge(med.status)}
                            </div>
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">{med.name}</h3>
                            <p className="text-sm text-gray-500 mb-4">{med.dosage} • {med.frequency}</p>
                            
                            <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg mb-4">
                                <div className="flex justify-between mb-1">
                                    <span>Start:</span>
                                    <span className="font-medium">{med.startDate}</span>
                                </div>
                                {med.endDate && (
                                    <div className="flex justify-between">
                                        <span>End:</span>
                                        <span className="font-medium">{med.endDate}</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex justify-end gap-2">
                                 <button onClick={() => { setMedForm(med); setShowMedModal(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                                     <i className="ri-edit-line"></i>
                                 </button>
                                 <button onClick={() => med.id && handleDeleteMedication(med.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                                     <i className="ri-delete-bin-line"></i>
                                 </button>
                            </div>
                        </Card>
                    ))}
                    {medications.length === 0 && (
                        <div className="col-span-full text-center py-12 text-gray-500">
                            No medications assigned.
                        </div>
                    )}
                </div>
             </>
          )}
          
          {/* Modal Replacement */}
          <MedicalRecordModal 
              isOpen={showRecordModal}
              onClose={() => setShowRecordModal(false)}
              onSuccess={fetchData}
              initialData={recordForm}
          />

           {/* Record Detail View Modal */}
           {selectedRecord && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                  <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-xl">
                      <div className="flex justify-between items-start mb-6">
                           <div>
                               <h2 className="text-2xl font-bold dark:text-white">{selectedRecord.title}</h2>
                               <p className="text-gray-500">{selectedRecord.date}</p>
                           </div>
                           <button onClick={() => setSelectedRecord(null)} className="text-gray-500 hover:text-gray-700"><i className="ri-close-line text-2xl"></i></button>
                      </div>
                      
                      <div className="space-y-4 mb-8">
                          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <h4 className="font-semibold mb-2 dark:text-white">Details</h4>
                              <p className="dark:text-gray-300"><span className="font-medium">Type:</span> {selectedRecord.type}</p>
                              <p className="dark:text-gray-300"><span className="font-medium">Doctor:</span> {selectedRecord.doctor}</p>
                              <p className="dark:text-gray-300"><span className="font-medium">Facility:</span> {selectedRecord.facility}</p>
                              <p className="dark:text-gray-300"><span className="font-medium">Status:</span> {selectedRecord.status}</p>
                          </div>
                          <div>
                              <h4 className="font-semibold mb-2 dark:text-white">Summary</h4>
                              <p className="text-gray-600 dark:text-gray-300">{selectedRecord.summary}</p>
                          </div>
                      </div>

                      <div className="flex gap-2">
                          <Button className="flex-1" onClick={() => { setRecordForm(selectedRecord); setSelectedRecord(null); setShowRecordModal(true); }}>Edit</Button>
                          <Button variant="outline" color="red" className="flex-1" onClick={() => selectedRecord.id && handleDeleteRecord(selectedRecord.id)}>Delete</Button>
                      </div>
                  </div>
              </div>
          )}

          {/* Medication Modal */}
          {showMedModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                   <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-xl">
                      <h2 className="text-xl font-bold mb-4 dark:text-white">{medForm.id ? 'Edit Medication' : 'Add Medication'}</h2>
                      <form onSubmit={handleSaveMedication} className="space-y-4">
                          <input type="text" placeholder="Medication Name" required className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                 value={medForm.name} onChange={e => setMedForm({...medForm, name: e.target.value})} />
                          <div className="grid grid-cols-2 gap-4">
                              <input type="text" placeholder="Dosage (e.g. 10mg)" required className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                     value={medForm.dosage} onChange={e => setMedForm({...medForm, dosage: e.target.value})} />
                              <input type="text" placeholder="Frequency (e.g. Daily)" required className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                     value={medForm.frequency} onChange={e => setMedForm({...medForm, frequency: e.target.value})} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="text-xs text-gray-500">Start Date</label>
                                  <input type="date" required className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                         value={medForm.startDate} onChange={e => setMedForm({...medForm, startDate: e.target.value})} />
                              </div>
                              <div>
                                  <label className="text-xs text-gray-500">End Date (Optional)</label>
                                  <input type="date" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                         value={medForm.endDate || ''} onChange={e => setMedForm({...medForm, endDate: e.target.value})} />
                              </div>
                          </div>
                          <div>
                              <label className="text-xs text-gray-500">Status</label>
                              <select className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                      value={medForm.status} onChange={e => setMedForm({...medForm, status: e.target.value as any})}>
                                  <option>Active</option><option>Completed</option><option>Discontinued</option>
                              </select>
                          </div>

                          <div className="flex justify-end gap-2 mt-4">
                              <Button type="button" variant="outline" onClick={() => setShowMedModal(false)}>Cancel</Button>
                              <Button type="submit" color="blue">Save</Button>
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

export default MedicalPage;
