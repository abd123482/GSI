'use client';

import { useState, useRef, useEffect } from 'react';
import { useAdminUsers } from '@/hooks/use-admin-users';
import { Search, Loader2 } from 'lucide-react';

interface UserAutocompleteProps {
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
  error?: string;
}

export function UserAutocomplete({ value, onChange, placeholder = "Rechercher un utilisateur...", error }: UserAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // We fetch a larger limit to have options available
  const { users, searchTerm, setSearchTerm, isUsersLoading } = useAdminUsers({ initialLimit: 50 });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [containerRef]);

  const selectedUser = users.find((u) => u.userId === value);
  const displayValue = isOpen 
    ? searchTerm 
    : (selectedUser ? (selectedUser.userName || selectedUser.userEmail) : value);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    onChange(''); // Clear selected value when typing
    setIsOpen(true);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 w-3.5 h-3.5 text-[#5c544d]" />
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full h-9 bg-[#2b2622] border ${error ? 'border-red-500' : 'border-[#3f3a36]'} rounded-[3px] pl-8 pr-3 text-sm focus:outline-none focus:border-[#aea69c] transition-colors text-[#f7f5f0] placeholder:text-[#5c544d]`}
        />
        {isUsersLoading && (
          <Loader2 className="absolute right-2.5 w-3.5 h-3.5 animate-spin text-[#aea69c]" />
        )}
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[#2f2a26] border border-[#3f3a36] rounded-[3px] shadow-lg max-h-60 overflow-y-auto">
          {users.length === 0 && !isUsersLoading ? (
            <div className="px-3 py-2 text-xs text-[#aea69c] text-center">Aucun utilisateur trouvé</div>
          ) : (
            <div className="p-1 space-y-0.5">
              {users.map((user) => (
                <button
                  key={user.userId}
                  type="button"
                  onClick={() => {
                    onChange(user.userId);
                    setSearchTerm('');
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-[2px] text-xs transition-colors hover:bg-[#383330] flex flex-col items-start gap-0.5"
                >
                  <span className="font-medium text-[#f7f5f0]">{user.userName || 'Sans nom'}</span>
                  <span className="text-[10px] text-[#aea69c]">{user.userEmail}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
