import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import PasswordProtection from '../../components/feature/PasswordProtection';
import { medicalService } from '../../services/medicalService';
import type { MedicalRecord, Medication } from '../../services/medicalService';
import MedicalRecordModal from '../../components/feature/MedicalRecordModal';
import { supabase } from '../../lib/supabase';
import { formatMMDDYYYYOr } from '../../utils/dateFormat';
import { useNavigate } from 'react-router-dom';

const MedicalPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'records' | 'medications' | 'candidates'>('candidates');
  const [isLoading, setIsLoading] = useState(true);
  
  // Candidates State
  const [candidates, setCandidates] = useState<any[]>([]);

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
      // Fetch all users who are Surrogates or Intended Parents for the "Candidates" list
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, email, role, profile_completed, form_data')
        .order('full_name', { ascending: true });

      setCandidates(usersData || []);

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
    <div className="flex h-screen bg-[#fdf4f6] dark:bg-[#0e0b1a]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <PasswordProtection menuName="medical">
          <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Medical Management</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Unified view of candidate health records and clinical progress.</p>
              </div>
              <div className="flex gap-2 bg-white/50 dark:bg-[#15111f] p-1 rounded-xl shadow-sm border border-rose-100/50 dark:border-white/5">
                  <button 
                      onClick={() => setActiveTab('candidates')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'candidates' ? 'bg-white dark:bg-white/10 shadow-md text-rose-500' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                      All Candidates
                  </button>
                  <button 
                      onClick={() => setActiveTab('records')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'records' ? 'bg-white dark:bg-white/10 shadow-md text-rose-500' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                      All Records
                  </button>
                  <button 
                       onClick={() => setActiveTab('medications')}
                       className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'medications' ? 'bg-white dark:bg-white/10 shadow-md text-rose-500' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                      Medications
                  </button>
              </div>
            </div>

            {/* Candidates Master List */}
            {activeTab === 'candidates' && (
               <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-rose-50/50 dark:bg-white/5 text-gray-600 dark:text-gray-400 text-[10px] uppercase tracking-widest font-black">
                        <tr>
                          <th className="px-6 py-4">Candidate Name</th>
                          <th className="px-6 py-4">Role</th>
                          <th className="px-6 py-4">Progress</th>
                          <th className="px-6 py-4">Last Update</th>
                          <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {candidates.map((c) => (
                          <tr key={c.id} className="hover:bg-rose-50/20 dark:hover:bg-white/5 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="font-bold text-gray-900 dark:text-white">{c.full_name || c.email}</div>
                              <div className="text-[10px] text-gray-400">{c.email}</div>
                            </td>
                            <td className="px-6 py-4">
                              <Badge color={c.role === 'Surrogate' ? 'rose' : 'blue'}>{c.role}</Badge>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${c.profile_completed ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: c.profile_completed ? '100%' : '40%' }}></div>
                                </div>
                                <span className="text-[10px] font-bold text-gray-400">{c.profile_completed ? '100%' : '40%'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs text-gray-500">
                               {formatMMDDYYYYOr(c.updated_at || c.created_at)}
                            </td>
                            <td className="px-6 py-4 text-right">
                               <Button size="sm" variant="outline" onClick={() => navigate(c.role === 'Surrogate' ? `/surrogates/${c.id}` : `/parents/${c.id}`)}>
                                  Review Records
                               </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </Card>
            )}

            {activeTab === 'records' && (
              <>
                <div className="flex justify-end mb-4">
                    <Button color="blue" onClick={() => { setRecordForm({}); setShowRecordModal(true); }}>
                        <i className="ri-add-line mr-2"></i> New Record
                    </Button>
                </div>
                
                <div className="space-y-4">
                    {records.map(record => (
                        <Card key={record.id} className="hover:shadow-md transition-shadow cursor-pointer border-rose-100/50 dark:border-white/5" onClick={() => setSelectedRecord(record)}>
                            <div className="flex justify-between items-start">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 flex-shrink-0">
                                        <i className="ri-file-list-3-line text-xl"></i>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white">{record.title}</h3>
                                        <p className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                            <i className="ri-calendar-line"></i> {record.date}
                                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                            <i className="ri-hospital-line"></i> {record.facility}
                                        </p>
                                    </div>
                                </div>
                                {getStatusBadge(record.status)}
                            </div>
                        </Card>
                    ))}
                </div>
              </>
            )}

            {activeTab === 'medications' && (
               <>
                <div className="flex justify-end mb-4">
                    <Button color="blue" onClick={() => { setMedForm({}); setShowMedModal(true); }}>
                        <i className="ri-add-line mr-2"></i> Add Medication
                    </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {medications.map(med => (
                        <Card key={med.id} className="border-rose-100/50 dark:border-white/5">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">{med.name}</h3>
                                    <p className="text-xs text-gray-500">{med.dosage} - {med.frequency}</p>
                                </div>
                                {getStatusBadge(med.status)}
                            </div>
                            <div className="p-3 bg-rose-50/50 dark:bg-white/5 rounded-xl text-[10px] text-gray-500 mb-4">
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
                                 <button onClick={(e) => { e.stopPropagation(); setMedForm(med); setShowMedModal(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><i className="ri-edit-line"></i></button>
                                 <button onClick={(e) => { e.stopPropagation(); med.id && handleDeleteMedication(med.id); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><i className="ri-delete-bin-line"></i></button>
                            </div>
                        </Card>
                    ))}
                </div>
               </>
            )}

            {/* Existing Modals */}
            <MedicalRecordModal isOpen={showRecordModal} onClose={() => setShowRecordModal(false)} onSuccess={fetchData} initialData={recordForm} />
            {selectedRecord && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#15111f] rounded-2xl max-w-lg w-full p-6 shadow-xl">
                        <div className="flex justify-between items-start mb-6">
                            <div><h2 className="text-2xl font-bold dark:text-white">{selectedRecord.title}</h2><p className="text-gray-500">{selectedRecord.date}</p></div>
                            <button onClick={() => setSelectedRecord(null)} className="text-gray-500 hover:text-gray-700"><i className="ri-close-line text-2xl"></i></button>
                        </div>
                        <div className="space-y-4 mb-8">
                            <div className="p-4 bg-rose-50/40 dark:bg-white/5 rounded-lg">
                                <h4 className="font-semibold mb-2 dark:text-white">Details</h4>
                                <p className="dark:text-gray-300 text-sm"><span className="font-medium">Type:</span> {selectedRecord.type}</p>
                                <p className="dark:text-gray-300 text-sm"><span className="font-medium">Doctor:</span> {selectedRecord.doctor}</p>
                                <p className="dark:text-gray-300 text-sm"><span className="font-medium">Facility:</span> {selectedRecord.facility}</p>
                                <p className="dark:text-gray-300 text-sm"><span className="font-medium">Status:</span> {selectedRecord.status}</p>
                            </div>
                            <div><h4 className="font-semibold mb-2 dark:text-white">Summary</h4><p className="text-gray-600 dark:text-gray-300 text-sm">{selectedRecord.summary}</p></div>
                        </div>
                        <div className="flex gap-2">
                            <Button className="flex-1" onClick={() => { setRecordForm(selectedRecord); setSelectedRecord(null); setShowRecordModal(true); }}>Edit</Button>
                            <Button variant="outline" color="red" className="flex-1" onClick={() => selectedRecord.id && handleDeleteRecord(selectedRecord.id)}>Delete</Button>
                        </div>
                    </div>
                </div>
            )}
            {showMedModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                   <div className="bg-white dark:bg-[#15111f] rounded-2xl max-w-lg w-full p-6 shadow-xl">
                      <h2 className="text-xl font-bold mb-4 dark:text-white">{medForm.id ? 'Edit Medication' : 'Add Medication'}</h2>
                      <form onSubmit={handleSaveMedication} className="space-y-4">
                          <input type="text" placeholder="Medication Name" required className="w-full p-3 border dark:border-white/10 rounded-xl dark:bg-white/5 dark:text-white" value={medForm.name} onChange={e => setMedForm({...medForm, name: e.target.value})} />
                          <div className="grid grid-cols-2 gap-4">
                              <input type="text" placeholder="Dosage" required className="p-3 border dark:border-white/10 rounded-xl dark:bg-white/5 dark:text-white" value={medForm.dosage} onChange={e => setMedForm({...medForm, dosage: e.target.value})} />
                              <input type="text" placeholder="Frequency" required className="p-3 border dark:border-white/10 rounded-xl dark:bg-white/5 dark:text-white" value={medForm.frequency} onChange={e => setMedForm({...medForm, frequency: e.target.value})} />
                          </div>
                          <div className="flex justify-end gap-2 mt-4"><Button type="button" variant="outline" onClick={() => setShowMedModal(false)}>Cancel</Button><Button type="submit" color="blue">Save</Button></div>
                      </form>
                   </div>
              </div>
            )}
          </main>
        </PasswordProtection>
      </div>
    </div>
  );
};

export default MedicalPage;
