import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

// Shared "Add User" modal used on the Parents and Surrogates list pages.
//
// Mirrors RecordInquiryDialog's pattern (optional Auth signUp using phone as
// the initial password, then insert into public.users) but is targeted at
// staff manually onboarding a new Intended Parent or Surrogate that the
// agency is working with directly — rather than recording an inbound phone
// inquiry.
//
// The created row is left with `profile_completed = false` so the person
// still sees the role-specific multi-step intake on first login.

type Role = 'Intended Parent' | 'Surrogate';

interface AddUserDialogProps {
  isOpen: boolean;
  role: Role;
  onClose: () => void;
  onSuccess: () => void;
}

const TITLE_BY_ROLE: Record<Role, string> = {
  'Intended Parent': 'Add Intended Parent',
  Surrogate: 'Add Surrogate',
};

const STATUS_BY_ROLE: Record<Role, string> = {
  // Matches the default first-stage statuses used by each list page.
  'Intended Parent': 'New Inquiry',
  Surrogate: 'New Application',
};

const AddUserDialog: React.FC<AddUserDialogProps> = ({ isOpen, role, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    location: '',
    notes: '',
  });

  if (!isOpen) return null;

  const resetForm = () =>
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      location: '',
      notes: '',
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const fullName = [formData.firstName, formData.lastName].filter(Boolean).join(' ').trim();

      const data: Record<string, unknown> = {
        full_name: fullName,
        email: formData.email || null,
        phone: formData.phone || null,
        description: formData.notes || null,
        // Flagged as manually created by admin staff so we can separate these
        // from inbound web/phone inquiries in reporting.
        source: 'manual',
        status: STATUS_BY_ROLE[role],
        role,
        profile_completed: false,
        data: {
          createdBy: 'admin',
          location: formData.location || undefined,
        },
      };

      // If an email is supplied, try to create an Auth user so the person can
      // log into the mobile app and complete their intake. Mirrors the logic
      // in RecordInquiryDialog — uses the phone number as the initial
      // password when it meets the 6-char minimum.
      if (formData.email) {
        if (formData.phone && formData.phone.length >= 6) {
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.phone,
            options: {
              data: { full_name: fullName, role },
            },
          });

          if (authError && !authError.message.includes('User already registered')) {
            throw authError;
          }
          if (authData?.user) {
            data.id = authData.user.id;
          }
        }
      }

      const { error: dbError } = await supabase.from('users').insert(data);
      if (dbError) throw dbError;

      resetForm();
      onSuccess();
      onClose();
    } catch (error: unknown) {
      // eslint-disable-next-line no-console
      console.error('Error adding user:', error);
      const msg = error instanceof Error ? error.message : 'Please check the details and try again.';
      alert(`Failed to add ${role}. ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#15111f] rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{TITLE_BY_ROLE[role]}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg cursor-pointer"
              aria-label="Close"
            >
              <i className="ri-close-line text-gray-600 dark:text-gray-400"></i>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-rose-100/60 dark:border-white/5 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-rose-100/60 dark:border-white/5 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                  placeholder="Last name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-rose-100/60 dark:border-white/5 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                placeholder="person@example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-rose-100/60 dark:border-white/5 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                  placeholder="555-555-1234"
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
                  className="w-full px-4 py-2 rounded-lg border border-rose-100/60 dark:border-white/5 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                  placeholder="City, State"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-rose-100/60 dark:border-white/5 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none resize-none"
                placeholder="Any context for this record…"
              />
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              If the phone number is 6+ characters, an Auth account will be created using it as the
              initial password so the person can sign in and complete their intake form.
            </p>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    Saving…
                  </>
                ) : (
                  <>
                    <i className="ri-user-add-line"></i>
                    Save {role}
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

export default AddUserDialog;
