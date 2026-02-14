import React, { useState, useRef, useEffect } from 'react';

interface Option {
  id: string;
  name: string;
  [key: string]: any;
}

interface MultiSearchableDropdownProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  required?: boolean;
}

const MultiSearchableDropdown: React.FC<MultiSearchableDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select options...",
  label,
  className = "",
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOptions = options.filter(opt => value.includes(opt.id));

  const filteredOptions = options.filter(opt =>
    opt.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const toggleOption = (optionId: string) => {
    const newValue = value.includes(optionId)
      ? value.filter(id => id !== optionId)
      : [...value, optionId];
    onChange(newValue);
  };

  const removeOption = (optionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter(id => id !== optionId));
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-h-[42px] px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus-within:ring-2 focus-within:ring-blue-500 outline-none cursor-pointer flex flex-wrap gap-2 items-center ${
          isOpen ? 'ring-2 ring-blue-500 border-transparent' : ''
        }`}
      >
        {selectedOptions.length > 0 ? (
          selectedOptions.map(option => (
            <span
              key={option.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md text-sm border border-blue-200 dark:border-blue-800"
            >
              {option.name}
              <button
                type="button"
                onClick={(e) => removeOption(option.id, e)}
                className="hover:text-blue-900 dark:hover:text-blue-100"
              >
                <i className="ri-close-line"></i>
              </button>
            </span>
          ))
        ) : (
          <span className="text-gray-500 dark:text-gray-400 text-sm ml-1">{placeholder}</span>
        )}
        <div className="flex-1 min-w-[50px]">
             {isOpen && (
                <input
                    ref={inputRef}
                    type="text"
                    className="w-full bg-transparent border-none outline-none text-sm p-0 focus:ring-0"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                />
             )}
        </div>
        <i className={`ri-arrow-down-s-line ml-auto text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
      </div>

      {isOpen && (
        <div className="absolute z-[60] mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = value.includes(option.id);
                return (
                  <div
                    key={option.id}
                    onClick={() => toggleOption(option.id)}
                    className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span>{option.name}</span>
                    {isSelected && <i className="ri-check-line"></i>}
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center italic">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
      {required && value.length === 0 && (
        <input
          tabIndex={-1}
          autoComplete="off"
          style={{ opacity: 0, height: 0, width: 0, position: 'absolute' }}
          required
          value=""
          onChange={() => {}}
        />
      )}
    </div>
  );
};

export default MultiSearchableDropdown;
