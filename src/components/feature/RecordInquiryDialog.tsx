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
    experience: '',
    // "How did you hear about us?" — required on every phone inquiry so we
    // can tell whether callers came from the marketing site, the mobile app,
    // a referral, etc.
    inquirySource: '' as '' | 'Website' | 'App' | 'Referral' | 'Social Media' | 'Event' | 'Other',
    inquirySourceOther: ''
  });

  const INQUIRY_SOURCES: Array<'Website' | 'App' | 'Referral' | 'Social Media' | 'Event' | 'Other'> = [
    'Website',
    'App',
    'Referral',
    'Social Media',
    'Event',
    'Other'
  ];

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const inquirySource = formData.inquirySource === 'Other'
        ? (formData.inquirySourceOther.trim() || 'Other')
        : formData.inquirySource;

      const extraData: Record<string, unknown> = variant === 'detailed'
        ? {
            age: formData.age,
            location: formData.location,
            experience: formData.experience
          }
        : {};
      if (inquirySource) extraData.inquirySource = inquirySource;

      const data: any = {
        full_name: formData.name,
        email: formData.email,
        phone: formData.phone,
        description: formData.message,
        source: 'phone',
        // Dedicated column so we can filter/group by channel without
        // touching the JSON blob. `data.inquirySource` is kept as the
        // source of truth for free-text "Other" values.
        inquiry_source: inquirySource || null,
        status: 'new',
        role: variant === 'detailed' ? (formData.role === 'Surrogate' ? 'Surrogate' : 'Intended Parent') : 'inquiry',
        data: extraData
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
        role: 'Intended Parents', age: '', location: '', experience: '',
        inquirySource: '', inquirySourceOther: ''
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
      <div className="bg-white dark:bg-[#15111f] rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Record Phone {variant === 'detailed' ? 'Request' : 'Inquiry'}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg cursor-pointer"
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
                        : 'border-rose-100/60 dark:border-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
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
                        : 'border-rose-100/60 dark:border-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
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
                className="w-full px-4 py-2 rounded-lg border border-rose-100/60 dark:border-white/5 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none transition-colors"
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
                  className="w-full px-4 py-2 rounded-lg border border-rose-100/60 dark:border-white/5 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none transition-colors"
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
                  className="w-full px-4 py-2 rounded-lg border border-rose-100/60 dark:border-white/5 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none transition-colors"
                  placeholder="Email (Optional)"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                How did they hear about us? *
              </label>
              <select
                required
                value={formData.inquirySource}
                onChange={(e) => setFormData({ ...formData, inquirySource: e.target.value as typeof formData.inquirySource })}
                className="w-full px-4 py-2 rounded-lg border border-rose-100/60 dark:border-white/5 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none transition-colors"
              >
                <option value="" disabled>Select a source…</option>
                {INQUIRY_SOURCES.map((src) => (
                  <option key={src} value={src}>{src}</option>
                ))}
              </select>
              {formData.inquirySource === 'Other' && (
                <input
                  type="text"
                  value={formData.inquirySourceOther}
                  onChange={(e) => setFormData({ ...formData, inquirySourceOther: e.target.value })}
                  className="mt-2 w-full px-4 py-2 rounded-lg border border-rose-100/60 dark:border-white/5 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none transition-colors"
                  placeholder="Please specify…"
                />
              )}
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
                      className="w-full px-4 py-2 rounded-lg border border-rose-100/60 dark:border-white/5 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none transition-colors"
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
                      className="w-full px-4 py-2 rounded-lg border border-rose-100/60 dark:border-white/5 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none transition-colors"
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
                    className="w-full px-4 py-2 rounded-lg border border-rose-100/60 dark:border-white/5 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none transition-colors resize-none"
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
                className="w-full px-4 py-2 rounded-lg border border-rose-100/60 dark:border-white/5 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none transition-colors resize-none"
                placeholder="Notes from the call..."
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
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
