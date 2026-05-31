import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import MultiSearchableDropdown from '../base/MultiSearchableDropdown';

interface MultiUserSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  role?: 'Surrogate' | 'Intended Parent';
  label?: string;
  placeholder?: string;
  required?: boolean;
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

const MultiUserSelector: React.FC<MultiUserSelectorProps> = ({
  value,
  onChange,
  role,
  label = 'Select Participants',
  placeholder = 'Search participants...',
  required = false,
}) => {
  const [options, setOptions] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftRole, setDraftRole] = useState<'Surrogate' | 'Intended Parent' | 'Other'>('Other');
  const [isSaving, setIsSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      // Per client review: also include externally-added participants (Other
      // role) so freshly created entries show up immediately.
      const roles = role ? [role] : ['Surrogate', 'Intended Parent', 'Other'];

      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, full_name, email, role, form_data')
        .in('role', roles);

      if (error) throw error;

      const users: UserOption[] = (data ?? []).map((row) => {
        const formData = row.form_data as Record<string, string> | null;
        let name =
          [formData?.firstName, formData?.lastName].filter(Boolean).join(' ') ||
          row.full_name ||
          [row.first_name, row.last_name].filter(Boolean).join(' ') ||
          row.email ||
          'Unknown User';

        return {
          id: row.id,
          name: `${name} (${row.role})`,
          role: row.role,
        };
      });

      setOptions(users.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error fetching users for multi-selector:', error);
    } finally {
      setIsLoading(false);
    }
  }, [role]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAddNew = (suggestedName: string) => {
    const trimmed = (suggestedName || '').trim();
    setDraftName(trimmed);
    setDraftEmail('');
    setDraftRole(role ?? 'Other');
    setAddError(null);
    setShowAddDialog(true);
  };

  const saveNewParticipant = async () => {
    setAddError(null);
    const trimmedName = draftName.trim();
    if (!trimmedName) {
      setAddError('Name is required.');
      return;
    }
    setIsSaving(true);
    try {
      const parts = trimmedName.split(' ');
      const first = parts[0];
      const last = parts.slice(1).join(' ');
      const email = draftEmail.trim();

      const { data, error } = await supabase
        .from('users')
        .insert({
          id: crypto.randomUUID(),
          first_name: first,
          last_name: last || null,
          full_name: trimmedName,
          email: email || null,
          role: draftRole,
        })
        .select('id, role, full_name, email')
        .single();

      if (error) throw error;
      if (!data) throw new Error('Insert returned no row');

      const newOption: UserOption = {
        id: data.id,
        name: `${data.full_name || trimmedName} (${data.role})`,
        role: data.role,
      };
      setOptions((prev) => [...prev, newOption].sort((a, b) => a.name.localeCompare(b.name)));
      onChange([...value, data.id]);
      setShowAddDialog(false);
    } catch (e: any) {
      console.error('Failed to add participant:', e);
      setAddError(e?.message || 'Could not add participant.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-full"></div>
      </div>
    );
  }

  return (
    <>
      <MultiSearchableDropdown
        label={label}
        placeholder={placeholder}
        options={options}
        value={value}
        onChange={onChange}
        required={required}
        onAddNew={handleAddNew}
        addNewLabel="Add new participant…"
      />

      {showAddDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isSaving && setShowAddDialog(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-[#15111f] border border-rose-100/60 dark:border-white/5 shadow-2xl p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add new participant</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Quickly add someone to attend this appointment.</p>
            <div className="space-y-4 mt-5">
              <label className="block">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Name <span className="text-red-500">*</span></span>
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white"
                  placeholder="Full name"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Email</span>
                <input
                  type="email"
                  value={draftEmail}
                  onChange={(e) => setDraftEmail(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white"
                  placeholder="optional"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Role</span>
                <select
                  value={draftRole}
                  onChange={(e) => setDraftRole(e.target.value as any)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white"
                >
                  <option value="Other">Other (guest)</option>
                  <option value="Surrogate">Surrogate</option>
                  <option value="Intended Parent">Intended Parent</option>
                </select>
              </label>
              {addError && <p className="text-sm text-red-500">{addError}</p>}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddDialog(false)}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-gray-700 dark:text-gray-200"
              >Cancel</button>
              <button
                type="button"
                onClick={saveNewParticipant}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              >{isSaving ? 'Adding…' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MultiUserSelector;
