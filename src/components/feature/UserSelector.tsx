import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import SearchableDropdown from '../base/SearchableDropdown';

interface UserSelectorProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (user: UserOption) => void;
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

const UserSelector: React.FC<UserSelectorProps> = ({
  value,
  onChange,
  onSelect,
  role,
  label = "Select User",
  placeholder = "Search surrogate or parent...",
  required = false
}) => {
  const [options, setOptions] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const rolesToFetch = role 
            ? (role === 'Surrogate' ? ['Surrogate', 'gestationalCarrier'] : ['Intended Parent', 'intendedParent'])
            : ['Surrogate', 'gestationalCarrier', 'Intended Parent', 'intendedParent'];
        
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .in('role', rolesToFetch);
        
        if (error) throw error;

        const users: UserOption[] = (data || []).map(u => {
          // Helper to get display name (similar to pages)
          let name = '';
          if (u.form_data) {
            name = [u.form_data.firstName, u.form_data.lastName].filter(Boolean).join(' ');
          }
          if (!name && u.full_name) {
            name = u.full_name;
          }
          if (!name) {
            name = [u.firstName, u.lastName].filter(Boolean).join(' ');
          }
          if (!name) {
            name = u.email || 'Unknown User';
          }

          return {
            id: u.id,
            name: `${name} (${u.role})`,
            role: u.role
          };
        });

        setOptions(users.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error("Error fetching users for selector:", error);
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
    <SearchableDropdown
      label={label}
      placeholder={placeholder}
      options={options}
      value={value}
      onChange={(val) => {
        onChange(val);
        if (onSelect) {
          const selected = options.find(o => o.id === val);
          if (selected) onSelect(selected);
        }
      }}
      required={required}
    />
  );
};

export default UserSelector;
