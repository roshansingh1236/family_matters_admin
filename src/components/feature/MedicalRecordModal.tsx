import React, { useState } from 'react';
import Button from '../base/Button';
import { medicalService } from '../../services/medicalService';
import type { MedicalRecord, Medication } from '../../services/medicalService';

interface MedicalRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: Partial<MedicalRecord>;
  userId?: string; // Associated User (Surrogate/Parent) ID
}

const MedicalRecordModal: React.FC<MedicalRecordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData = {},
  userId
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showAddMedication, setShowAddMedication] = useState(false);
  const [recordForm, setRecordForm] = useState<Partial<MedicalRecord>>({
    title: '',
    type: 'Screening',
    date: new Date().toISOString().split('T')[0],
    doctor: '',
    facility: '',
    summary: '',
    status: 'Pending',
    sharedWithParents: false,
    ...initialData
  });

  const [medForm, setMedForm] = useState<Partial<Medication>>({
    name: '',
    dosage: '',
    frequency: '',
    startDate: new Date().toISOString().split('T')[0],
    status: 'Active'
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // 1. Save Medical Record with userId
      let recordId = recordForm.id;
      const recordData = { ...recordForm, userId };
      
      if (recordId) {
        await medicalService.updateRecord(recordId, recordData);
      } else {
        const newRecord = await medicalService.createRecord(recordData as any);
        // Assuming result might contain ID or we might need it for medication
        // For simplicity, we just proceed
      }

      // 2. Save Medication if requested with userId
      if (showAddMedication && medForm.name) {
        const medicationData = { ...medForm, userId };
        await medicalService.addMedication(medicationData as any);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving medical information:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold dark:text-white">
              {recordForm.id ? 'Edit Medical Record' : 'New Medical Record'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
            >
              <i className="ri-close-line text-2xl text-gray-500"></i>
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 border-b border-blue-100 dark:border-blue-900 pb-2 flex items-center gap-2">
                <i className="ri-file-list-3-line"></i> Record Details
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Initial Screening"
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  value={recordForm.title || ''}
                  onChange={e => setRecordForm({ ...recordForm, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                  <select
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={recordForm.type}
                    onChange={e => setRecordForm({ ...recordForm, type: e.target.value as any })}
                  >
                    <option>Screening</option>
                    <option>Lab Result</option>
                    <option>Ultrasound</option>
                    <option>Vaccination</option>
                    <option>Examination</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={recordForm.date || ''}
                    onChange={e => setRecordForm({ ...recordForm, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Doctor</label>
                  <input
                    type="text"
                    placeholder="Enter physician name"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={recordForm.doctor || ''}
                    onChange={e => setRecordForm({ ...recordForm, doctor: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Facility</label>
                  <input
                    type="text"
                    placeholder="Medical center/Clinic"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={recordForm.facility || ''}
                    onChange={e => setRecordForm({ ...recordForm, facility: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Summary / Notes</label>
                <textarea
                  placeholder="Additional details about the visit or findings..."
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  rows={3}
                  value={recordForm.summary || ''}
                  onChange={e => setRecordForm({ ...recordForm, summary: e.target.value })}
                ></textarea>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <input
                  type="checkbox"
                  id="share-parents"
                  className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  checked={recordForm.sharedWithParents}
                  onChange={e => setRecordForm({ ...recordForm, sharedWithParents: e.target.checked })}
                />
                <label htmlFor="share-parents" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer flex items-center gap-2">
                  <i className="ri-eye-line text-green-500"></i>
                  Automatically share this record with parents
                </label>
              </div>
            </div>

            {/* Integrated Medication Section */}
            <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowAddMedication(!showAddMedication)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-semibold ${
                  showAddMedication 
                    ? 'text-red-600 bg-red-50 dark:bg-red-900/20' 
                    : 'text-purple-600 bg-purple-50 dark:bg-purple-900/20'
                }`}
              >
                <i className={showAddMedication ? "ri-subtract-line" : "ri-add-line"}></i>
                {showAddMedication ? 'Remove Medication Block' : 'Add Medication to this Record'}
              </button>

              {showAddMedication && (
                <div className="mt-4 p-4 bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-xl space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <h3 className="text-purple-700 dark:text-purple-400 font-bold flex items-center gap-2">
                    <i className="ri-capsule-line"></i> New Medication
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Medication Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Prenatal Vitamins"
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                      value={medForm.name || ''}
                      onChange={e => setMedForm({ ...medForm, name: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dosage</label>
                      <input
                        type="text"
                        placeholder="e.g. 500mg"
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                        value={medForm.dosage || ''}
                        onChange={e => setMedForm({ ...medForm, dosage: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frequency</label>
                      <input
                        type="text"
                        placeholder="e.g. Once daily"
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                        value={medForm.frequency || ''}
                        onChange={e => setMedForm({ ...medForm, frequency: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                      value={medForm.startDate || ''}
                      onChange={e => setMedForm({ ...medForm, startDate: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1 py-3 text-lg"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                color="blue"
                className="flex-1 py-3 text-lg shadow-lg shadow-blue-500/30"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <i className="ri-loader-4-line animate-spin"></i> Saving...
                  </span>
                ) : 'Save Records'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MedicalRecordModal;
