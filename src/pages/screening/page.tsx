
import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { screeningService } from '../../services/screeningService';
import type { MedicalScreening } from '../../types';

const ScreeningPage: React.FC = () => {
  const [screenings, setScreenings] = useState<MedicalScreening[]>([]);
  const [selectedScreening, setSelectedScreening] = useState<MedicalScreening | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Review Modal State
  const [reviewNotes, setReviewNotes] = useState('');

  useEffect(() => {
    fetchScreenings();
  }, []);

  const fetchScreenings = async () => {
    setIsLoading(true);
    try {
      const data = await screeningService.getAllScreenings();
      setScreenings(data);
    } catch (error) {
      console.error('Error fetching screenings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecision = async (status: 'Cleared' | 'Rejected') => {
    if (!selectedScreening) return;
    try {
      await screeningService.updateStatus(selectedScreening.id, status, reviewNotes);
      fetchScreenings();
      setSelectedScreening(null);
      setReviewNotes('');
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Cleared': return <Badge color="green">Cleared</Badge>;
      case 'Rejected': return <Badge color="red">Rejected</Badge>;
      case 'In Review': return <Badge color="blue">In Review</Badge>;
      default: return <Badge color="yellow">Pending</Badge>;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Medical Screening</h1>
            <p className="text-gray-600 dark:text-gray-400">Review surrogate medical histories and records.</p>
          </div>

          {/* List View */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Surrogate</th>
                    <th className="px-6 py-3 font-semibold">Date Submitted</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {isLoading ? (
                    <tr><td colSpan={4} className="text-center py-8">Loading...</td></tr>
                  ) : screenings.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-gray-500">No pending screenings</td></tr>
                  ) : (
                    screenings.map((screening) => (
                      <tr key={screening.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {screening.surrogateName || 'Unknown User'}
                          </div>
                          <div className="text-xs text-gray-500">{screening.surrogateId}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                           {new Date(screening.submittedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(screening.status)}</td>
                        <td className="px-6 py-4 text-right">
                          <Button size="sm" variant="outline" onClick={() => setSelectedScreening(screening)}>
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </main>
      </div>

      {/* Review Modal */}
      {selectedScreening && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Screening Review: {selectedScreening.surrogateName}
                </h2>
                <p className="text-sm text-gray-500">Submitted {new Date(selectedScreening.submittedAt).toLocaleString()}</p>
              </div>
              <button 
                onClick={() => setSelectedScreening(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Medical History */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-200 dark:border-gray-700">
                      Obstetric History
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-gray-500 block">Pregnancies</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                           {selectedScreening.medicalHistory?.pregnancies ?? 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">Live Births</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                           {selectedScreening.medicalHistory?.liveBirths ?? 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">C-Sections</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                           {selectedScreening.medicalHistory?.csSections ?? 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">BMI</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                           {selectedScreening.medicalHistory?.bmi ?? 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-200 dark:border-gray-700">
                      Raw Medical Data
                    </h3>
                    <pre className="text-xs bg-gray-100 dark:bg-gray-950 p-4 rounded overflow-x-auto">
                      {JSON.stringify(selectedScreening.medicalHistory, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Sidebar: Documents & Actions */}
                <div className="space-y-6">
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                     <h3 className="font-semibold mb-3">Documents</h3>
                     {selectedScreening.documents?.length > 0 ? (
                        <ul className="space-y-2">
                           {selectedScreening.documents.map((doc, idx) => (
                             <li key={idx} className="flex justify-between items-start text-sm">
                               <a href={doc.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate max-w-[150px]">
                                 {doc.name}
                               </a>
                               <span className="text-gray-500 text-xs">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                             </li>
                           ))}
                        </ul>
                     ) : <p className="text-gray-500 text-sm">No documents uploaded.</p>}
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                     <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Admin Review</h3>
                     <textarea
                       className="w-full text-sm p-3 border rounded-md dark:bg-gray-700 dark:border-gray-600 min-h-[100px] mb-3"
                       placeholder="Enter review notes..."
                       value={reviewNotes}
                       onChange={(e) => setReviewNotes(e.target.value)}
                     ></textarea>
                     
                     <div className="flex gap-2">
                       <Button 
                         color="green" 
                         className="flex-1" 
                         onClick={() => handleDecision('Cleared')}
                         disabled={selectedScreening.status === 'Cleared'}
                       >
                         Clear
                       </Button>
                       <Button 
                         color="red" 
                         className="flex-1" 
                         onClick={() => handleDecision('Rejected')}
                         disabled={selectedScreening.status === 'Rejected'}
                       >
                         Reject
                       </Button>
                     </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScreeningPage;
