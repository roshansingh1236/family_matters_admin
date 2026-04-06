import React, { useState, useRef, useEffect } from 'react';

interface Option {
  id: string;
  name: string;
  [key: string]: any;
}

interface SearchableDropdownProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  required?: boolean;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  label,
  className = "",
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(opt => opt.id === value);

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
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setIsOpen(false);
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
        className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md text-slate-900 dark:text-white focus-within:ring-2 focus-within:ring-rose-500/20 outline-none cursor-pointer flex justify-between items-center transition-all duration-200 shadow-sm ${
          isOpen ? 'ring-2 ring-rose-500/50 border-rose-500/50' : 'hover:border-rose-300 dark:hover:border-white/20'
        }`}
      >
        <span className={!selectedOption ? "text-slate-400 dark:text-slate-500 font-medium" : "font-semibold text-slate-700 dark:text-white"}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <i className={`ri-arrow-down-s-line transition-transform duration-300 ${isOpen ? 'rotate-180 text-rose-500' : 'text-slate-400'}`}></i>
      </div>

      {isOpen && (
        <div className="absolute z-[60] mt-2 w-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-3 border-b border-slate-100 dark:border-white/5">
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input
                ref={inputRef}
                type="text"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/50 dark:text-white placeholder-slate-400 transition-all"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.id}
                  onClick={() => handleSelect(option.id)}
                  className={`px-4 py-3 text-sm cursor-pointer transition-all flex items-center justify-between mx-1 my-0.5 rounded-xl ${
                    option.id === value
                      ? 'bg-rose-500 text-white font-bold shadow-md shadow-rose-500/20'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                  }`}
                >
                  <span>{option.name}</span>
                  {option.id === value && <i className="ri-check-line text-lg"></i>}
                </div>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center italic">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
      {required && !value && <input tabIndex={-1} autoComplete="off" style={{ opacity: 0, height: 0, width: 0, position: 'absolute' }} required value="" onChange={() => {}} />}
    </div>
  );
};

export default SearchableDropdown;
