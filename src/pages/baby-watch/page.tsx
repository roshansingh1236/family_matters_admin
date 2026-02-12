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
  const [cases, setCases] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCase, setSelectedCase] = useState<string>('all');
  const [selectedUpdate, setSelectedUpdate] = useState<BabyWatchUpdate | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<BabyWatchUpdate>>({
    caseId: '',
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
        name: `${doc.data().surrogateName} & ${doc.data().parentName}`
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
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Cases ({updates.length})</option>
              {cases.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({updates.filter(u => u.caseId === c.id).length})
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
                    className="hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
                    onClick={() => setSelectedUpdate(update)}
                  >
                    {update.imageUrl && (
                      <div className="w-full h-48 bg-gray-100 dark:bg-gray-700 mb-4 -mt-6 -mx-6 overflow-hidden">
                        <img 
                          src={update.imageUrl} 
                          alt="Ultrasound" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {update.gestationalAge}
                        </span>
                        {update.sharedWithParents && (
                          <Badge color="green">Shared</Badge>
                        )}
                      </div>

                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <div className="flex items-center gap-2">
                          <i className="ri-calendar-line"></i>
                          <span>{update.date}</span>
                        </div>
                        {update.weight && (
                          <div className="flex items-center gap-2">
                            <i className="ri-scales-line"></i>
                            <span>{update.weight}</span>
                          </div>
                        )}
                        {update.heartRate && (
                          <div className="flex items-center gap-2">
                            <i className="ri-heart-pulse-line"></i>
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
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Update Details</h2>
                    <button
                      onClick={() => setSelectedUpdate(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <i className="ri-close-line text-xl text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  {selectedUpdate.imageUrl && (
                    <div className="mb-6 rounded-lg overflow-hidden">
                      <img 
                        src={selectedUpdate.imageUrl} 
                        alt="Ultrasound" 
                        className="w-full h-auto"
                      />
                    </div>
                  )}

                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {selectedUpdate.gestationalAge}
                      </h3>
                      {selectedUpdate.sharedWithParents && (
                        <Badge color="green">Shared with Parents</Badge>
                      )}
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Date</h4>
                          <p className="text-gray-600 dark:text-gray-300">{selectedUpdate.date}</p>
                        </div>
                        {selectedUpdate.weight && (
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Weight</h4>
                            <p className="text-gray-600 dark:text-gray-300">{selectedUpdate.weight}</p>
                          </div>
                        )}
                        {selectedUpdate.heartRate && (
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Heart Rate</h4>
                            <p className="text-gray-600 dark:text-gray-300">{selectedUpdate.heartRate}</p>
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Medical Notes</h4>
                        <p className="text-gray-600 dark:text-gray-300">{selectedUpdate.medicalNotes}</p>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button color="blue" className="flex-1" onClick={() => handleOpenEditModal(selectedUpdate)}>
                        <i className="ri-edit-line mr-2"></i>
                        Edit
                      </Button>
                      <Button 
                        color="red" 
                        variant="outline" 
                        className="flex-1" 
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
          )}

          {/* Create/Edit Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <form onSubmit={handleSubmit} className="p-6">
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
                          onChange={e => setFormData({ ...formData, caseId: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="">Select Case</option>
                          {cases.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
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

                  <div className="flex gap-3 mt-6">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" color="blue" className="flex-1" disabled={isLoading}>
                      {isLoading ? 'Saving...' : 'Save Update'}
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
