import React, { useState, useEffect } from 'react';
import { supabase, createAuthAccountForOther } from '../../lib/supabase';
import { emailService } from '../../services/emailService';
import { generateRandomPassword } from '../../utils/password';

// Shared "Add User" modal used on the Parents and Surrogates list pages.
//
// Automatically generates a secure temporary password for both Intended Parents
// and Surrogates, provisions their Supabase Auth account, saves their profile,
// and emails the temporary credentials to their address with instructions
// that they can change their password later.

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
  // Matches the default first-stage statuses used by each list page
  // (see IP_STATUSES / GC_STATUSES in types)
  'Intended Parent': 'Inquiry',
  Surrogate: 'New Application',
};

const AddUserDialog: React.FC<AddUserDialogProps> = ({ isOpen, role, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    location: '',
    notes: '',
    password: '',
  });

  // Automatically generate a temporary password whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData((prev) => ({
        ...prev,
        password: prev.password || generateRandomPassword(10),
      }));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      location: '',
      notes: '',
      password: generateRandomPassword(10),
    });
    setShowPassword(false);
    setCopied(false);
    setSendEmail(true);
  };

  const handleRegeneratePassword = () => {
    const newPass = generateRandomPassword(10);
    setFormData((prev) => ({ ...prev, password: newPass }));
  };

  const handleCopyPassword = async () => {
    if (!formData.password) return;
    try {
      await navigator.clipboard.writeText(formData.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const email = formData.email.trim();
      const password = (formData.password || '').trim();

      if (!email) {
        throw new Error('Email address is required.');
      }

      if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }

      const fullName = [formData.firstName, formData.lastName].filter(Boolean).join(' ').trim();

      // Only real `users` columns belong here — location and notes live
      // in the `about` JSONB blob.
      const about: Record<string, unknown> = {};
      if (formData.location) about.location = formData.location;
      if (formData.notes) about.notes = formData.notes;

      // 1. Create the Supabase Auth account with the auto-generated password.
      // Sign-ups go through an isolated client so creating this account does
      // not disturb or log out the admin's own session.
      const newUserId = await createAuthAccountForOther(email, password, {
        full_name: fullName,
        role,
      });

      if (!newUserId) {
        throw new Error(
          'An account with this email already exists in Auth. Use a different email, or find the existing record in the list.',
        );
      }

      const data: Record<string, unknown> = {
        id: newUserId,
        first_name: formData.firstName || null,
        last_name: formData.lastName || null,
        full_name: fullName,
        email,
        phone: formData.phone || null,
        about,
        form_data: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone || null,
          location: formData.location || null,
        },
        status: STATUS_BY_ROLE[role],
        role,
        profile_completed: false,
      };

      // 2. The `handle_new_user` trigger on auth.users already creates a matching
      // public.users row during sign-up, so upsert fills in the rest of the details.
      const { error: dbError } = await supabase
        .from('users')
        .upsert(data, { onConflict: 'id' });
      if (dbError) throw dbError;

      // 3. Dispatch transactional welcome email with credentials
      let emailDispatched = false;
      let emailErrorMsg: string | undefined;

      if (sendEmail) {
        const emailResult = await emailService.sendCredentials({
          userId: newUserId,
          email,
          name: fullName || formData.firstName,
          password,
          role,
        });

        emailDispatched = emailResult.success;
        if (!emailResult.success) {
          emailErrorMsg = emailResult.error;
        }
      }

      resetForm();
      onSuccess();
      onClose();

      // 4. Clear feedback for the admin
      if (sendEmail) {
        if (emailDispatched) {
          alert(`✅ ${role} added successfully!\n\nLogin credentials and temporary password have been emailed to ${email}.\n\nTemporary Password: ${password}`);
        } else {
          alert(`⚠️ ${role} added successfully!\n\nHowever, the credentials email could not be delivered automatically (${emailErrorMsg || 'Email delivery unconfigured'}).\n\nPlease share this temporary password with the user directly:\n👉 ${password}`);
        }
      } else {
        alert(`✅ ${role} added successfully!\n\nTemporary password: ${password}`);
      }
    } catch (error: unknown) {
      // eslint-disable-next-line no-console
      console.error('Error adding user:', error);
      const msg = error instanceof Error ? error.message : 'Please check the details and try again.';
      alert(`Failed to add ${role}. ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-4 py-2 rounded-lg border border-rose-100/60 dark:border-white/5 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none';

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
                  className={inputClass}
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
                  className={inputClass}
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
                className={inputClass}
                placeholder="person@example.com"
              />
            </div>

            {/* Auto-generated Temporary Password field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Temporary Login Password *
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRegeneratePassword}
                    className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1 font-medium cursor-pointer"
                    title="Generate a new random password"
                  >
                    <i className="ri-refresh-line"></i>
                    <span>Regenerate</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1 font-medium cursor-pointer ml-1"
                    title="Copy password to clipboard"
                  >
                    <i className={copied ? "ri-check-line text-emerald-500" : "ri-file-copy-line"}></i>
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`${inputClass} pr-10 font-mono text-sm`}
                  placeholder="Min. 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Auto-generated secure password. The user can log in with this password and change it at any time.
              </p>
            </div>

            {/* Email credentials notification checkbox */}
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40">
              <input
                type="checkbox"
                id="sendCredentialsEmail"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-rose-500 focus:ring-rose-400 cursor-pointer"
              />
              <label htmlFor="sendCredentialsEmail" className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer leading-relaxed">
                <span className="font-semibold text-gray-900 dark:text-white">Email credentials to user:</span> Send an automatic email containing this temporary password and sign-in instructions to <span className="font-medium underline">{formData.email || 'their email'}</span>.
              </label>
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
                  className={inputClass}
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
                  className={inputClass}
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
                className={`${inputClass} resize-none`}
                placeholder="Any context for this record…"
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-sm shadow-rose-500/20"
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
