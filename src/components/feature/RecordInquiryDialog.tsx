import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface RecordInquiryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  variant?: 'simple' | 'detailed';
}

const RecordInquiryDialog: React.FC<RecordInquiryDialogProps> = ({ isOpen, onClose, onSuccess, variant = 'simple' }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    role: 'Intended Parents',
    age: '',
    location: '',
    experience: ''
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data: any = {
        full_name: formData.name,
        email: formData.email,
        phone: formData.phone,
        description: formData.message,
        source: 'phone',
        status: 'new',
        role: variant === 'detailed' ? (formData.role === 'Surrogate' ? 'Surrogate' : 'Intended Parent') : 'inquiry',
        data: variant === 'detailed' ? {
            age: formData.age,
            location: formData.location,
            experience: formData.experience
        } : {}
      };

      // If email is provided, try to create an Auth user
      if (formData.email) {
        if (formData.phone.length < 6) {
           alert("Phone number too short to be used as password (min 6 chars). Inquiry saved without account creation.");
        }

        try {
          // Use phone number as password
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.phone,
            options: {
                data: {
                    full_name: formData.name,
                    role: data.role
                }
            }
          });

          if (authError) {
             if (authError.message.includes('User already registered')) {
                alert("Email already in use. Saving inquiry without creating a new account.");
             } else {
                throw authError;
             }
          }
          
          if (authData.user) {
             data.id = authData.user.id;
          }
        } catch (authError: any) {
             console.error("Auth creation failed:", authError);
             throw authError;
        }
      }

      // Save to Supabase users table
      const { error: dbError } = await supabase
        .from('users')
        .insert(data);

      if (dbError) throw dbError;

      setFormData({
        name: '', email: '', phone: '', message: '',
        role: 'Intended Parents', age: '', location: '', experience: ''
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error recording inquiry:", error);
      alert("Failed to record inquiry. Please check the details and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Record Phone {variant === 'detailed' ? 'Request' : 'Inquiry'}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
            >
              <i className="ri-close-line text-gray-600 dark:text-gray-400"></i>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {variant === 'detailed' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'Intended Parents' })}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      formData.role === 'Intended Parents'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    Intended Parent
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'Surrogate' })}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      formData.role === 'Surrogate'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    Surrogate
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                placeholder="Caller's Name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                  placeholder="Phone Number"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                  placeholder="Email (Optional)"
                />
              </div>
            </div>

            {variant === 'detailed' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Age
                    </label>
                    <input
                      type="text"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                      placeholder="Age"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                      placeholder="City, State"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Experience / Background
                  </label>
                  <textarea
                    rows={2}
                    value={formData.experience}
                    onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors resize-none"
                    placeholder="Relevant experience..."
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Message / Notes
              </label>
              <textarea
                rows={variant === 'detailed' ? 3 : 4}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors resize-none"
                placeholder="Notes from the call..."
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="ri-save-line"></i>
                    Save {variant === 'detailed' ? 'Request' : 'Inquiry'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RecordInquiryDialog;
