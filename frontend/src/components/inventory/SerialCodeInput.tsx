import { useState, useEffect } from 'react';
import { Loader2, Search } from 'lucide-react';
import { useSerialNumbers } from '@/hooks/use-serial-numbers';

interface SerialCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SerialCodeInput({ value, onChange, placeholder, className }: SerialCodeInputProps) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, 500);
    return () => clearTimeout(timer);
  }, [value]);

  const { data, isLoading } = useSerialNumbers(
    { serialNumberCode: debouncedValue, limit: 1 },
    debouncedValue.trim().length > 0
  );

  const matchedSerial = data?.serialNumbers?.[0];
  const exactMatch = matchedSerial?.serialNumberCode?.toLowerCase() === debouncedValue.trim().toLowerCase();

  return (
    <div className="flex w-full flex-col gap-1 relative">
      <div className="relative w-full">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
        />
        {isLoading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#71717a]" />
          </div>
        )}
      </div>
      
      {exactMatch && matchedSerial && (
        <div className="flex items-center gap-1.5 px-1 pt-0.5 text-[10px] text-emerald-400">
          <Search className="h-3 w-3" />
          <span>
            {matchedSerial.equipment?.equipmentName || 'Article inconnu'}
            {matchedSerial.shelf ? ` • Attendu dans: ${matchedSerial.shelf.shelfName}` : ' • Aucun emplacement attendu'}
          </span>
        </div>
      )}
    </div>
  );
}
