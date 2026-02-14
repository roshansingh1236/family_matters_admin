import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { babyWatchService, type BabyWatchUpdate } from '../../services/babyWatchService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const BabyWatchPage: React.FC = () => {
  const [updates, setUpdates] = useState<BabyWatchUpdate[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<string>('all');
  const [selectedUpdate, setSelectedUpdate] = useState<BabyWatchUpdate | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<BabyWatchUpdate>>({
    caseId: '',
    parentId: '',
    parentName: '',
    surrogateId: '',
    surrogateName: '',
    date: new Date().toISOString().split('T')[0],
    gestationalAge: '',
    weight: '',
    heartRate: '',
    medicalNotes: '',
    sharedWithParents: true
  });

  const fetchUpdates = async () => {
    setIsLoading(true);
    try {
      const data = await babyWatchService.getAllUpdates();
      setUpdates(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load updates');
      setUpdates([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCases = async () => {
    try {
      const casesSnapshot = await getDocs(collection(db, 'cases'));
      const casesData = casesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        displayName: `${doc.data().surrogateName} & ${doc.data().parentName}`
      }));
      setCases(casesData);
    } catch (err) {
      console.error('Error fetching cases:', err);
    }
  };

  useEffect(() => {
    fetchUpdates();
    fetchCases();
  }, []);

  const filteredUpdates = selectedCase === 'all' 
    ? updates 
    : updates.filter(u => u.caseId === selectedCase);

  const handleOpenNewModal = () => {
    setFormData({
      caseId: '',
      parentId: '',
      parentName: '',
      surrogateId: '',
      surrogateName: '',
      date: new Date().toISOString().split('T')[0],
      gestationalAge: '',
      weight: '',
      heartRate: '',
      medicalNotes: '',
      sharedWithParents: true
    });
    setImageFile(null);
    setImagePreview(null);
    setShowModal(true);
  };

  const handleOpenEditModal = (update: BabyWatchUpdate) => {
    setFormData(update);
    setImagePreview(update.imageUrl || null);
    setImageFile(null);
    setShowModal(true);
    setSelectedUpdate(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (formData.id) {
        await babyWatchService.updateUpdate(formData.id, formData, imageFile || undefined);
      } else {
        await babyWatchService.createUpdate(formData as Omit<BabyWatchUpdate, 'id'>, imageFile || undefined);
      }
      await fetchUpdates();
      setShowModal(false);
    } catch (err) {
      console.error(err);
      setError('Failed to save update');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, imagePath?: string) => {
    if (!window.confirm('Are you sure you want to delete this update?')) return;
    setIsLoading(true);
    try {
      await babyWatchService.deleteUpdate(id, imagePath);
      await fetchUpdates();
      setSelectedUpdate(null);
    } catch (err) {
      setError('Failed to delete update');
    } finally {
      setIsLoading(false);
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
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Baby Watch</h1>
                <p className="text-gray-600 dark:text-gray-400">Medical updates and ultrasound tracking.</p>
              </div>
              <Button color="blue" onClick={handleOpenNewModal}>
                <i className="ri-add-line mr-2"></i>
                New Update
              </Button>
            </div>
          </div>

          {/* Case Filter */}
          <div className="mb-6">
            <select
              value={selectedCase}
              onChange={(e) => setSelectedCase(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200/50 dark:border-gray-700/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm hover:shadow-md"
            >
              <option value="all">All Cases ({updates.length})</option>
              {cases.map(c => (
                <option key={c.id} value={c.id}>
                  {c.displayName} ({updates.filter(u => u.caseId === c.id).length})
                </option>
              ))}
            </select>
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUpdates.length === 0 ? (
                <div className="col-span-full text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                  <i className="ri-heart-pulse-line text-4xl text-gray-400 mb-2"></i>
                  <p className="text-gray-500 dark:text-gray-400">No updates found.</p>
                </div>
              ) : (
                filteredUpdates.map((update) => (
                  <Card 
                    key={update.id} 
                    padding="none"
                    className="group hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/10 hover:-translate-y-1 flex flex-col"
                    onClick={() => setSelectedUpdate(update)}
                  >
                    {update.imageUrl && (
                      <div className="w-full h-56 bg-gray-100 dark:bg-gray-900 overflow-hidden relative">
                        <img 
                          src={update.imageUrl} 
                          alt="Ultrasound" 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                      </div>
                    )}
                    
                    <div className="p-6 space-y-4 flex-1 flex flex-col">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {update.gestationalAge}
                        </span>
                        {update.sharedWithParents && (
                          <Badge color="green">Shared</Badge>
                        )}
                      </div>

                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <i className="ri-calendar-line"></i>
                          </div>
                          <span>{update.date}</span>
                        </div>
                        {update.weight && (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center text-pink-600 dark:text-pink-400">
                              <i className="ri-scales-line"></i>
                            </div>
                            <span>{update.weight}</span>
                          </div>
                        )}
                        {update.heartRate && (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                              <i className="ri-heart-pulse-line"></i>
                            </div>
                            <span>{update.heartRate}</span>
                          </div>
                        )}
                      </div>

                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                        {update.medicalNotes}
                      </p>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Update Detail Modal */}
          {selectedUpdate && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-xl transition-all duration-300 animate-in fade-in">
              <div className="bg-white/90 dark:bg-gray-900/90 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20 dark:border-white/5 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="relative">
                  <button
                    onClick={() => setSelectedUpdate(null)}
                    className="absolute top-4 right-4 z-10 p-3 bg-black/20 hover:bg-black/40 backdrop-blur-md text-white rounded-full transition-all"
                  >
                    <i className="ri-close-line text-xl"></i>
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* Left: Image */}
                    <div className="bg-gray-100 dark:bg-gray-800">
                      {selectedUpdate.imageUrl ? (
                        <img 
                          src={selectedUpdate.imageUrl} 
                          alt="Ultrasound" 
                          className="w-full h-full object-cover min-h-[400px]"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-12 text-gray-400">
                          <i className="ri-image-line text-6xl mb-4"></i>
                          <p>No image available</p>
                        </div>
                      )}
                    </div>

                    {/* Right: Content */}
                    <div className="p-8 space-y-8">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-xs font-bold uppercase tracking-wider">
                            Medical Update
                          </span>
                          {selectedUpdate.sharedWithParents && (
                            <Badge color="green">Shared with Parents</Badge>
                          )}
                        </div>
                        <h2 className="text-4xl font-black text-gray-900 dark:text-white leading-tight">
                          {selectedUpdate.gestationalAge}
                        </h2>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1 items-center flex gap-2">
                            <i className="ri-calendar-line text-blue-500"></i> Date
                          </p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedUpdate.date}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1 items-center flex gap-2">
                            <i className="ri-scales-line text-pink-500"></i> Weight
                          </p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedUpdate.weight || 'N/A'}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1 items-center flex gap-2">
                            <i className="ri-heart-pulse-line text-red-500"></i> Heart Rate
                          </p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedUpdate.heartRate || 'N/A'}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1 items-center flex gap-2">
                            <i className="ri-user-line text-purple-500"></i> Surrogate
                          </p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedUpdate.surrogateName || 'N/A'}</p>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Medical Notes</h4>
                        <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20">
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed italic">
                            "{selectedUpdate.medicalNotes}"
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4 pt-4">
                        <Button color="blue" className="flex-1 py-4 text-lg rounded-2xl shadow-lg shadow-blue-500/20" onClick={() => handleOpenEditModal(selectedUpdate)}>
                          <i className="ri-edit-line mr-2"></i>
                          Edit
                        </Button>
                        <Button 
                          color="red" 
                          variant="outline" 
                          className="flex-1 py-4 text-lg rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/10" 
                          onClick={() => selectedUpdate.id && handleDelete(selectedUpdate.id, selectedUpdate.imagePath)}
                        >
                          <i className="ri-delete-bin-line mr-2"></i>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create/Edit Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-xl animate-in fade-in transition-all">
              <div className="bg-white/95 dark:bg-gray-900/95 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20 dark:border-white/5 animate-in zoom-in-95 duration-200">
                <form onSubmit={handleSubmit} className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {formData.id ? 'Edit Update' : 'New Update'}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <i className="ri-close-line text-xl text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Image Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Ultrasound Image
                      </label>
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center">
                        {imagePreview ? (
                          <div className="relative">
                            <img src={imagePreview} alt="Preview" className="max-h-64 mx-auto rounded-lg" />
                            <button
                              type="button"
                              onClick={() => {
                                setImageFile(null);
                                setImagePreview(null);
                              }}
                              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                            >
                              <i className="ri-delete-bin-line"></i>
                            </button>
                          </div>
                        ) : (
                          <div>
                            <i className="ri-image-add-line text-4xl text-gray-400 mb-2"></i>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              Click to upload or drag and drop
                            </p>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageChange}
                              className="hidden"
                              id="image-upload"
                            />
                            <label
                              htmlFor="image-upload"
                              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700"
                            >
                              Choose File
                            </label>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Case</label>
                        <select
                          required
                          value={formData.caseId}
                          onChange={e => {
                            const caseId = e.target.value;
                            const selectedCaseObj = cases.find(c => c.id === caseId);
                            setFormData({ 
                              ...formData, 
                              caseId,
                              parentId: selectedCaseObj?.parentId || '',
                              parentName: selectedCaseObj?.parentName || '',
                              surrogateId: selectedCaseObj?.surrogateId || '',
                              surrogateName: selectedCaseObj?.surrogateName || ''
                            });
                          }}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="">Select Case</option>
                          {cases.map(c => (
                            <option key={c.id} value={c.id}>{c.displayName}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                        <input
                          type="date"
                          required
                          value={formData.date}
                          onChange={e => setFormData({ ...formData, date: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Gestational Age
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.gestationalAge}
                          onChange={e => setFormData({ ...formData, gestationalAge: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="e.g. 12 Weeks"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Weight</label>
                        <input
                          type="text"
                          value={formData.weight}
                          onChange={e => setFormData({ ...formData, weight: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="e.g. 50g"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Heart Rate</label>
                        <input
                          type="text"
                          value={formData.heartRate}
                          onChange={e => setFormData({ ...formData, heartRate: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="e.g. 150 bpm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Medical Notes</label>
                      <textarea
                        required
                        value={formData.medicalNotes}
                        onChange={e => setFormData({ ...formData, medicalNotes: e.target.value })}
                        rows={4}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        placeholder="Everything looks great! Baby is developing well..."
                      ></textarea>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="shared"
                        checked={formData.sharedWithParents}
                        onChange={e => setFormData({ ...formData, sharedWithParents: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <label htmlFor="shared" className="text-sm text-gray-700 dark:text-gray-300">
                        Share with parents
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-4 mt-8">
                    <Button type="button" variant="outline" className="flex-1 py-4 text-lg rounded-2xl" onClick={() => setShowModal(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" color="blue" className="flex-1 py-4 text-lg rounded-2xl shadow-lg shadow-blue-500/20" disabled={isLoading}>
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <i className="ri-loader-4-line animate-spin"></i>
                          Saving...
                        </span>
                      ) : 'Save Update'}
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

export default BabyWatchPage;
