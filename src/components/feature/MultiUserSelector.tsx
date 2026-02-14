import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
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
  label = "Select Participants",
  placeholder = "Search participants...",
  required = false
}) => {
  const [options, setOptions] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const rolesToFetch = role ? [role] : ['Surrogate', 'Intended Parent'];
        
        const q = query(
          usersRef, 
          where('role', 'in', rolesToFetch)
        );
        
        const querySnapshot = await getDocs(q);
        const users: UserOption[] = querySnapshot.docs.map(doc => {
          const data = doc.data();
          
          let name = '';
          if (data.formData) {
            name = [data.formData.firstName, data.formData.lastName].filter(Boolean).join(' ');
          }
          if (!name && data.parent1?.name) {
            name = data.parent1.name;
          }
          if (!name) {
            name = [data.firstName, data.lastName].filter(Boolean).join(' ');
          }
          if (!name) {
            name = data.email || 'Unknown User';
          }

          return {
            id: doc.id,
            name: `${name} (${data.role})`,
            role: data.role
          };
        });

        setOptions(users.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error("Error fetching users for multi-selector:", error);
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
