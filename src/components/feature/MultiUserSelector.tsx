import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const roles = role ? [role] : ['Surrogate', 'Intended Parent'];

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
    };

    fetchUsers();
  }, [role]);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-full"></div>
      </div>
    );
  }

  return (
    <MultiSearchableDropdown
      label={label}
      placeholder={placeholder}
      options={options}
      value={value}
      onChange={onChange}
      required={required}
    />
  );
};

export default MultiUserSelector;
